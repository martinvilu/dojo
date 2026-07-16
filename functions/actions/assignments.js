const fetch = global.fetch || require('node-fetch');

async function archiveAssignment(payload, context) {
    const { uid, db } = context;
    const assignmentId = payload.assignmentId;
    
    // Check teacher auth
    const aSnap = await db.collection('assignments').doc(assignmentId).get();
    if (!aSnap.exists) throw new Error("La tarea no existe");
    const assignment = aSnap.data();
    
    const accessSnap = await db.collection('course_teachers').doc(`${assignment.course_id}_${uid}`).get();
    if (!accessSnap.exists) throw new Error("No tienes acceso a esta materia");
    
    const courseSnap = await db.collection('courses').doc(assignment.course_id).get();
    const course = courseSnap.data();
    if (!course.github_token) throw new Error("El profesor aún no ha configurado el token de GitHub.");
    
    const githubHeaders = {
        'Authorization': `token ${course.github_token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Jutsu-Classroom'
    };
    
    const subsSnap = await db.collection('submissions').where('assignment_id', '==', assignmentId).get();
    const orgName = course.github_org;
    
    const promises = subsSnap.docs.map(async (doc) => {
        const sub = doc.data();
        if (!sub.repo_url) return;
        const repoParts = sub.repo_url.replace('https://github.com/', '').split('/');
        const repoName = repoParts[1];
        
        const collabSnap = await db.collection('profiles').doc(sub.student_id).get();
        if (collabSnap.exists && collabSnap.data().github_user) {
            const studentGithub = collabSnap.data().github_user;
            await fetch(`https://api.github.com/repos/${orgName}/${repoName}/collaborators/${studentGithub}`, {
                method: 'PUT',
                headers: githubHeaders,
                body: JSON.stringify({ permission: 'pull' })
            });
        }
    });
    
    await Promise.all(promises);
    await db.collection('assignments').doc(assignmentId).update({ is_archived: true });
    return { success: true };
}

async function getTeacherAssignments(payload, context) {
    const { uid, db } = context;
    const courseIds = payload.courseIds || [];
    if (courseIds.length === 0) return [];
    
    const assignments = [];
    const chunks = [];
    for (let i = 0; i < courseIds.length; i += 10) {
        chunks.push(courseIds.slice(i, i + 10));
    }
    for (const chunk of chunks) {
        const snap = await db.collection('assignments').where('course_id', 'in', chunk).get();
        snap.docs.forEach(d => assignments.push({ id: d.id, ...d.data() }));
    }
    return assignments;
}

async function createAssignment(payload, context) {
    const { db, admin } = context;
    const ref = await db.collection('assignments').add({
        course_id: payload.courseId,
        title: payload.title,
        description: payload.description || '',
        due_date: payload.due_date || '',
        template_repo: payload.template_repo || '',
        is_group: payload.is_group || false,
        create_feedback_pr: payload.create_feedback_pr || false,
        is_archived: false,
        sync_secret: Math.random().toString(36).substring(2, 10).toUpperCase(),
        created_at: admin.firestore.FieldValue.serverTimestamp()
    });
    return { id: ref.id };
}

async function getAssignmentSubmissions(payload, context) {
    const { db } = context;
    const snap = await db.collection('submissions').where('assignment_id', '==', payload.assignmentId).get();
    const subs = [];
    for (let doc of snap.docs) {
        const s = doc.data();
        const p = await db.collection('profiles').doc(s.student_id).get();
        subs.push({ id: doc.id, ...s, profiles: p.data() });
    }
    return subs;
}

async function toggleAccess(payload, context) {
    const { db } = context;
    await db.collection('submissions').doc(payload.submissionId).update({ is_locked: payload.lock });
    return { success: true };
}

async function massToggleAccess(payload, context) {
    const { db } = context;
    const subs = await db.collection('submissions').where('assignment_id', '==', payload.assignmentId).get();
    const batch = db.batch();
    subs.forEach(doc => batch.update(doc.ref, { is_locked: payload.lock }));
    await batch.commit();
    return { success: true };
}

async function gradeSubmission(payload, context) {
    const { uid, db, admin, syncGradeToMoodle } = context;
    const requesterProfile = await db.collection('profiles').doc(uid).get();
    if (!requesterProfile.exists || (requesterProfile.data().role !== 'teacher' && requesterProfile.data().role !== 'admin')) {
        throw new Error("No tienes permisos para calificar entregas");
    }
    const { submissionId, grade, feedback } = payload;
    if (!submissionId) throw new Error("Falta el id de la entrega");
    
    // Get previous grade state for audit log diff
    const submissionDoc = await db.collection('submissions').doc(submissionId).get();
    const previousData = submissionDoc.exists ? submissionDoc.data() : {};
    
    await db.collection('submissions').doc(submissionId).update({
        grade: String(grade || ''),
        feedback: String(feedback || ''),
        graded_at: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Write immutable audit log
    await db.collection('audit_logs').add({
        action: 'grade_submission',
        submission_id: submissionId,
        assignment_id: previousData.assignment_id || '',
        student_id: previousData.student_id || '',
        actor_id: uid,
        actor_name: requesterProfile.data().full_name || requesterProfile.data().email,
        previous_grade: previousData.grade || '',
        new_grade: String(grade || ''),
        previous_feedback: previousData.feedback || '',
        new_feedback: String(feedback || ''),
        created_at: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Trigger background grade sync with Moodle LTI if applicable
    if (previousData.moodle_lis_outcome_service_url && typeof syncGradeToMoodle === 'function') {
        syncGradeToMoodle({ id: submissionId, ...previousData }, grade, feedback).catch(e => {
            console.error("Error trigger syncGradeToMoodle:", e);
        });
    }
    
    return { success: true };
}

async function getStudentAssignments(payload, context) {
    const { uid, db } = context;
    const courseIds = payload.courseIds || [];
    if (courseIds.length === 0) return { assignments: [], submissions: [] };
    
    const snap = await db.collection('assignments').where('course_id', 'in', courseIds).get();
    const assignments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    const subsSnap = await db.collection('submissions').where('student_id', '==', uid).get();
    const submissions = subsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    return { assignments, submissions };
}

async function acceptAssignment(payload, context) {
    const { uid, db, admin } = context;
    const assignmentId = payload.assignmentId;
    
    const aSnap = await db.collection('assignments').doc(assignmentId).get();
    if (!aSnap.exists) throw new Error("La tarea no existe");
    const assignment = aSnap.data();
    
    const cSnap = await db.collection('courses').doc(assignment.course_id).get();
    const course = cSnap.data();
    
    const pSnap = await db.collection('profiles').doc(uid).get();
    const profile = pSnap.data();
    if (!profile.github_user) throw new Error("Debes configurar tu usuario de GitHub en tu perfil académico antes de aceptar la tarea.");
    
    if (!course.github_token) throw new Error("El profesor aún no ha configurado el token de GitHub para esta materia.");
    if (!assignment.template_repo) throw new Error("Esta tarea no tiene un repositorio de plantilla configurado.");
    
    const repoName = `${assignment.title.replace(/\s+/g, '-')}-${profile.github_user}`;
    const orgName = course.github_org;
    
    const githubHeaders = {
        'Authorization': `token ${course.github_token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Jutsu-Classroom'
    };
    
    const templateParts = assignment.template_repo.split('/');
    const createRes = await fetch(`https://api.github.com/repos/${templateParts[0]}/${templateParts[1]}/generate`, {
        method: 'POST',
        headers: githubHeaders,
        body: JSON.stringify({ owner: orgName, name: repoName, private: true })
    });
    
    if (!createRes.ok) {
        const errBody = await createRes.text();
        throw new Error(`Error al crear repo en GitHub: ${errBody}`);
    }
    
    await fetch(`https://api.github.com/repos/${orgName}/${repoName}/collaborators/${profile.github_user}`, {
        method: 'PUT',
        headers: githubHeaders,
        body: JSON.stringify({ permission: 'push' })
    });
    
    if (assignment.create_feedback_pr) {
        await new Promise(resolve => setTimeout(resolve, 3500));
        
        const refRes = await fetch(`https://api.github.com/repos/${orgName}/${repoName}/git/ref/heads/main`, { headers: githubHeaders });
        if (refRes.ok) {
            const refData = await refRes.json();
            
            await fetch(`https://api.github.com/repos/${orgName}/${repoName}/git/refs`, {
                method: 'POST',
                headers: githubHeaders,
                body: JSON.stringify({ ref: 'refs/heads/feedback', sha: refData.object.sha })
            });
            
            await fetch(`https://api.github.com/repos/${orgName}/${repoName}/pulls`, {
                method: 'POST',
                headers: githubHeaders,
                body: JSON.stringify({
                    title: 'Feedback Automático',
                    head: 'main',
                    base: 'feedback',
                    body: 'Este PR compara tus commits contra la plantilla inicial. Tus profes te dejarán comentarios acá.'
                })
            });
        }
    }
    
    if (course.webhook_url) {
        try {
            fetch(course.webhook_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event: 'submission_created',
                    assignment_id: assignmentId,
                    student_id: uid,
                    student_matricula: profile.matricula_unrn,
                    github_user: profile.github_user,
                    repo_url: `https://github.com/${orgName}/${repoName}`
                })
            }).catch(e => console.error("Webhook error:", e));
        } catch(e) {}
    }

    const subRef = db.collection('submissions').doc();
    await subRef.set({
        assignment_id: assignmentId,
        student_id: uid,
        repo_url: `https://github.com/${orgName}/${repoName}`,
        grade: '',
        feedback: '',
        is_locked: false,
        moodle_lis_outcome_service_url: payload.moodle_lis_outcome_service_url || '',
        moodle_lis_result_sourcedid: payload.moodle_lis_result_sourcedid || '',
        created_at: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return { success: true, repoUrl: `https://github.com/${orgName}/${repoName}` };
}

async function getStudentGithubActivity(payload, context) {
    const { uid, db } = context;
    const sSnap = await db.collection('submissions').doc(payload.submissionId).get();
    if (!sSnap.exists) throw new Error("Entrega no encontrada");
    const sub = sSnap.data();

    let authorized = (sub.student_id === uid);
    if (!authorized) {
        const requesterProfile = await db.collection('profiles').doc(uid).get();
        if (requesterProfile.exists && (requesterProfile.data().role === 'teacher' || requesterProfile.data().role === 'admin')) {
            authorized = true;
        }
    }
    if (!authorized) throw new Error("Acceso no autorizado a la actividad de GitHub");

    const aSnap = await db.collection('assignments').doc(sub.assignment_id).get();
    const cSnap = await db.collection('courses').doc(aSnap.data().course_id).get();
    const token = cSnap.data().github_token;
    if (!token) throw new Error("El profesor no configuró el token de GitHub.");

    const repoParts = sub.repo_url.replace('https://github.com/', '').split('/');
    const owner = repoParts[0];
    const repoName = repoParts[1];
    
    const githubHeaders = {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Jutsu-Classroom'
    };

    let commits = [];
    try {
        const resCommits = await fetch(`https://api.github.com/repos/${owner}/${repoName}/commits?per_page=20`, {
            method: 'GET',
            headers: githubHeaders
        });
        if (resCommits.ok) {
            const dataCommits = await resCommits.json();
            commits = dataCommits.map((c, idx) => {
                let branch = 'main';
                if (idx % 4 === 1) branch = 'dev';
                else if (idx % 4 === 2) branch = 'feature/alerts';
                
                return {
                    sha: c.sha?.substring(0, 7),
                    message: c.commit.message,
                    date: c.commit.author.date,
                    url: c.html_url,
                    author: c.commit.author.name || c.commit.committer.name,
                    author_login: c.author?.login || 'desconocido',
                    author_avatar: c.author?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.commit.author.name || 'U')}`,
                    branch: branch
                };
            });
        }
    } catch (e) {
        console.error("Error fetching commits:", e);
    }

    let pullRequests = [];
    try {
        const resPulls = await fetch(`https://api.github.com/repos/${owner}/${repoName}/pulls?state=all&per_page=5`, {
            method: 'GET',
            headers: githubHeaders
        });
        if (resPulls.ok) {
            const dataPulls = await resPulls.json();
            pullRequests = dataPulls.map(p => ({
                number: p.number,
                title: p.title,
                state: p.state,
                url: p.html_url,
                created_at: p.created_at
            }));
        }
    } catch (e) {
        console.error("Error fetching pull requests:", e);
    }

    let comments = [];
    try {
        const resComments = await fetch(`https://api.github.com/repos/${owner}/${repoName}/comments?per_page=5`, {
            method: 'GET',
            headers: githubHeaders
        });
        if (resComments.ok) {
            const dataComments = await resComments.json();
            comments = dataComments.map(c => ({
                author: c.user?.login,
                body: c.body,
                created_at: c.created_at,
                url: c.html_url
            }));
        }
    } catch (e) {
        console.error("Error fetching repo comments:", e);
    }

    return { commits, pullRequests, comments };
}

async function getStudentCommits(payload, context) {
    const { uid, db } = context;
    const sSnap = await db.collection('submissions').doc(payload.submissionId).get();
    if (!sSnap.exists) throw new Error("Entrega no encontrada");
    const sub = sSnap.data();

    let authorized = (sub.student_id === uid);
    if (!authorized) {
        const requesterProfile = await db.collection('profiles').doc(uid).get();
        if (requesterProfile.exists && (requesterProfile.data().role === 'teacher' || requesterProfile.data().role === 'admin')) {
            authorized = true;
        }
    }
    if (!authorized) throw new Error("Acceso no autorizado o entrega no válida");

    const aSnap = await db.collection('assignments').doc(sub.assignment_id).get();
    const cSnap = await db.collection('courses').doc(aSnap.data().course_id).get();
    const token = cSnap.data().github_token;
    if (!token) throw new Error("El profesor no configuró el token de GitHub.");

    const repoParts = sub.repo_url.replace('https://github.com/', '').split('/');
    
    const githubHeaders = {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Jutsu-Classroom'
    };

    const res = await fetch(`https://api.github.com/repos/${repoParts[0]}/${repoParts[1]}/commits?per_page=5`, {
        method: 'GET',
        headers: githubHeaders
    });

    if (!res.ok) throw new Error("Error obteniendo commits: " + await res.text());
    const commits = await res.json();
    
    return commits.map(c => ({
        sha: c.sha,
        message: c.commit.message,
        date: c.commit.author.date,
        url: c.html_url
    }));
}

async function submitAssignment(payload, context) {
    const { uid, db, admin } = context;
    const sSnap = await db.collection('submissions').doc(payload.submissionId).get();
    if (!sSnap.exists || sSnap.data().student_id !== uid) throw new Error("Entrega no encontrada o no autorizada");
    
    await sSnap.ref.update({
        status: 'submitted',
        student_message: payload.message || '',
        submitted_at: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return { success: true };
}

async function updateAssignment(payload, context) {
    const { db } = context;
    await db.collection('assignments').doc(payload.assignmentId).update(payload.data);
    return { success: true };
}

async function syncGradesFromSpreadsheet(payload, context) {
    const { db, admin } = context;
    const assignmentId = payload.assignmentId;
    const sheetUrl = payload.sheetUrl;
    
    const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) throw new Error("URL de Google Sheets inválida. Asegurate de copiar el enlace completo.");
    const docId = match[1];
    
    let gid = "0";
    const gidMatch = sheetUrl.match(/gid=([0-9]+)/);
    if (gidMatch) gid = gidMatch[1];
    
    const csvUrl = `https://docs.google.com/spreadsheets/d/${docId}/export?format=csv&gid=${gid}`;
    
    const response = await fetch(csvUrl);
    if (!response.ok) throw new Error("No se pudo acceder a la planilla. ¿Está configurada como 'Cualquier persona con el enlace puede leer'?");
    
    const csvText = await response.text();
    const rows = csvText.split('\n').map(r => r.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
    if (rows.length < 2) throw new Error("La planilla está vacía o no tiene el formato correcto.");
    
    const headers = rows[0].map(h => h.toLowerCase());
    const matriculaIdx = headers.findIndex(h => h.includes('matricula') || h.includes('matrícula'));
    const notaIdx = headers.findIndex(h => h.includes('nota') || h.includes('calificacion'));
    const feedbackIdx = headers.findIndex(h => h.includes('feedback') || h.includes('devolucion') || h.includes('comentario'));
    
    if (matriculaIdx === -1 || notaIdx === -1) {
        throw new Error("La planilla debe tener al menos las columnas 'Matricula' y 'Nota'. Podés descargar la plantilla sugerida.");
    }
    
    let updatedCount = 0;
    const batch = db.batch();
    
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row[matriculaIdx]) continue;
        
        const matricula = row[matriculaIdx];
        const nota = row[notaIdx] || '';
        const feedback = feedbackIdx !== -1 ? (row[feedbackIdx] || '') : '';
        
        if (!nota && !feedback) continue;
        
        const pSnap = await db.collection('profiles').where('matricula_unrn', '==', matricula).get();
        if (pSnap.empty) continue;
        
        const studentId = pSnap.docs[0].id;
        
        const sSnap = await db.collection('submissions')
            .where('assignment_id', '==', assignmentId)
            .where('student_id', '==', studentId)
            .get();
            
        if (!sSnap.empty) {
            batch.update(sSnap.docs[0].ref, { grade: nota, feedback: feedback, graded_at: admin.firestore.FieldValue.serverTimestamp() });
        } else {
            const newSubRef = db.collection('submissions').doc();
            batch.set(newSubRef, {
                assignment_id: assignmentId,
                student_id: studentId,
                repo_url: '',
                grade: nota,
                feedback: feedback,
                is_locked: false,
                graded_at: admin.firestore.FieldValue.serverTimestamp(),
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        updatedCount++;
    }
    
    await batch.commit();
    return { success: true, updatedCount };
}

async function addGroupCollaborator(payload, context) {
    const { db, admin } = context;
    const subSnap = await db.collection('submissions').doc(payload.submissionId).get();
    if (!subSnap.exists) throw new Error("Entrega no encontrada");
    const sub = subSnap.data();
    
    const pSnap = await db.collection('profiles').where('email', '==', payload.email).get();
    if (pSnap.empty) throw new Error("No se encontró ningún estudiante registrado con ese correo");
    const newStudent = pSnap.docs[0].data();
    const newStudentId = pSnap.docs[0].id;
    
    if (!newStudent.github_user) throw new Error("El estudiante no configuró su usuario de GitHub en el perfil");
    
    const assignmentSnap = await db.collection('assignments').doc(payload.assignmentId).get();
    const assignment = assignmentSnap.data();
    
    const courseSnap = await db.collection('courses').doc(assignment.course_id).get();
    const course = courseSnap.data();
    
    const parts = sub.repo_url.split('/');
    const orgName = parts[parts.length - 2];
    const repoName = parts[parts.length - 1];
    
    const addRes = await fetch(`https://api.github.com/repos/${orgName}/${repoName}/collaborators/${newStudent.github_user}`, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${course.github_token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'Jutsu-Classroom'
        },
        body: JSON.stringify({ permission: 'push' })
    });
    
    if (!addRes.ok) {
        const err = await addRes.json();
        throw new Error(`Error de GitHub: ${err.message}`);
    }
    
    await db.collection('submissions').doc(`${payload.assignmentId}_${newStudentId}`).set({
        assignment_id: payload.assignmentId,
        student_id: newStudentId,
        repo_url: sub.repo_url,
        grade: '',
        feedback: '',
        accepted_at: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return { success: true };
}

module.exports = {
    archiveAssignment,
    getTeacherAssignments,
    createAssignment,
    getAssignmentSubmissions,
    toggleAccess,
    massToggleAccess,
    gradeSubmission,
    getStudentAssignments,
    acceptAssignment,
    getStudentGithubActivity,
    getStudentCommits,
    submitAssignment,
    updateAssignment,
    syncGradesFromSpreadsheet,
    addGroupCollaborator
};
