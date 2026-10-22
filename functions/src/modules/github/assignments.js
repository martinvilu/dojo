const fetch = global.fetch || require('node-fetch');
const logger = require("firebase-functions/logger");
const { HttpsError } = require('firebase-functions/v2/https');
const { randomBytes } = require('node:crypto');
const { isSafeExternalUrl } = require('../../lib/urls');
const { isCourseStaff, isCourseMember } = require('../../authz');
const { normalizeGrade, normalizeFeedback } = require('../../lib/grades');
const { courseGithubToken } = require('../../lib/encryption');
const { resolveRules } = require('../../lib/academic/rules');
const { lateness } = require('../../lib/academic/deadlines');
const { publishSingleGrade } = require('../integrations/lti');
const { assertCanEditStudents, staffCommissionScope, outOfScope } = require('../../lib/courseGuards');

// Tokens de autograding de 32 hex chars: resistentes a fuerza bruta
// (los viejos de 8 chars siguen válidos hasta que se regeneren).
function generateSyncSecret() {
    return randomBytes(16).toString('hex').toUpperCase();
}

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
    const githubToken = courseGithubToken(assignment.course_id, course);
    if (!githubToken) throw new Error("El profesor aún no ha configurado el token de GitHub.");
    
    const githubHeaders = {
        'Authorization': `token ${githubToken}`,
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
    const count = subsSnap.docs.filter(doc => doc.data().repo_url).length;
    return { success: true, count };
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

const TEMPLATE_REPO_RE = /^([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100})$/;
const EDITABLE_ASSIGNMENT_FIELDS = ['title', 'description', 'due_date', 'template_repo', 'is_group', 'create_feedback_pr', 'is_required'];
const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 10000;

function invalid(message) {
    return new HttpsError('invalid-argument', message);
}

/** Acepta `org/repo` o una URL de GitHub y devuelve `org/repo`. */
function normalizeTemplateRepo(value) {
    const text = String(value || '').trim()
        .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
        .replace(/\.git$/i, '')
        .replace(/\/+$/, '');
    if (!TEMPLATE_REPO_RE.test(text)) {
        throw invalid("El repositorio plantilla debe tener el formato 'organizacion/repositorio'.");
    }
    return text;
}

function parseDateOnly(value, label) {
    const text = String(value || '').trim();
    const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T23:59:59` : text);
    if (!text || Number.isNaN(date.getTime())) throw invalid(`La fecha ${label} no es válida.`);
    return date;
}

/**
 * Valida y normaliza los campos editables de una tarea (mejora 3.24).
 * Con `partial` solo procesa los campos presentes (edición); si no, exige
 * título. Ignora cualquier otro campo del payload (course_id, sync_secret…).
 */
async function sanitizeAssignmentFields(input, { db, courseId, partial = false }) {
    const out = {};
    const has = (key) => Object.prototype.hasOwnProperty.call(input, key) && input[key] !== undefined;

    if (has('title') || !partial) {
        const title = String(input.title || '').trim();
        if (!title) throw invalid('La tarea necesita un título.');
        if (title.length > MAX_TITLE_LENGTH) throw invalid(`El título admite hasta ${MAX_TITLE_LENGTH} caracteres.`);
        out.title = title;
    }
    if (has('description')) {
        const description = String(input.description);
        if (description.length > MAX_DESCRIPTION_LENGTH) {
            throw invalid(`La descripción admite hasta ${MAX_DESCRIPTION_LENGTH} caracteres.`);
        }
        out.description = description;
    } else if (!partial) {
        out.description = '';
    }
    if (has('template_repo') && String(input.template_repo).trim() !== '') {
        out.template_repo = normalizeTemplateRepo(input.template_repo);
    } else if (has('template_repo') || !partial) {
        out.template_repo = '';
    }
    if (has('is_group') || !partial) out.is_group = Boolean(input.is_group);
    if (has('create_feedback_pr') || !partial) out.create_feedback_pr = Boolean(input.create_feedback_pr);
    // Obligatorio para regularizar salvo que se indique lo contrario.
    if (has('is_required') || !partial) out.is_required = input.is_required !== false;

    if (has('due_date') && String(input.due_date).trim() !== '') {
        const due = parseDateOnly(input.due_date, 'de entrega');
        const cSnap = await db.collection('courses').doc(String(courseId)).get();
        const startDate = cSnap && cSnap.exists ? cSnap.data().start_date : null;
        if (startDate) {
            const start = new Date(`${String(startDate).slice(0, 10)}T00:00:00`);
            if (!Number.isNaN(start.getTime()) && due < start) {
                throw invalid('La fecha de entrega no puede ser anterior al inicio de la cursada.');
            }
        }
        out.due_date = String(input.due_date).trim();
    } else if (has('due_date') || !partial) {
        out.due_date = '';
    }
    return out;
}

async function createAssignment(payload, context) {
    const { db, admin } = context;
    const courseId = payload.course_id || payload.courseId || payload.course;
    if (!courseId) {
        throw new Error("El parámetro course_id es requerido para crear una tarea.");
    }

    const fields = await sanitizeAssignmentFields({
        title: payload.title ?? payload.name,
        description: payload.description,
        due_date: payload.due_date ?? payload.dueDate,
        template_repo: payload.template_repo ?? payload.templateRepo,
        is_group: payload.is_group ?? payload.isGroup,
        create_feedback_pr: payload.create_feedback_pr ?? payload.createFeedbackPr,
        is_required: payload.is_required
    }, { db, courseId });

    const ref = await db.collection('assignments').add({
        course_id: String(courseId),
        ...fields,
        is_archived: false,
        sync_secret: generateSyncSecret(),
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
    const { submissionId } = payload;
    if (!submissionId) throw new Error("Falta el id de la entrega");
    const normalized = normalizeGrade(payload.grade);
    if (!normalized.ok) throw new HttpsError('invalid-argument', normalized.error);
    const grade = normalized.value;
    const feedback = normalizeFeedback(payload.feedback);
    
    // Get previous grade state for audit log diff
    const submissionDoc = await db.collection('submissions').doc(submissionId).get();
    const previousData = submissionDoc.exists ? submissionDoc.data() : {};
    const assignmentSnap = previousData.assignment_id ? await db.collection('assignments').doc(previousData.assignment_id).get() : null;
    if (assignmentSnap && assignmentSnap.exists) {
        await assertCanEditStudents(db, assignmentSnap.data().course_id, uid, [previousData.student_id]);
    }
    
    await db.collection('submissions').doc(submissionId).update({
        grade,
        feedback,
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
        new_grade: grade,
        previous_feedback: previousData.feedback || '',
        new_feedback: feedback,
        created_at: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // LTI 1.3 AGS: publica la nota si el curso está vinculado a Moodle.
    await publishSingleGrade(db, {
        assignmentId: previousData.assignment_id, studentId: previousData.student_id, grade, feedback,
    });

    // Trigger background grade sync with Moodle LTI if applicable
    if (previousData.moodle_lis_outcome_service_url && typeof syncGradeToMoodle === 'function') {
        syncGradeToMoodle({ id: submissionId, ...previousData }, grade, feedback).catch(e => {
            logger.error("Error trigger syncGradeToMoodle:", e);
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
    
    const githubToken = courseGithubToken(assignment.course_id, course);
    if (!githubToken) throw new Error("El profesor aún no ha configurado el token de GitHub para esta materia.");
    if (!assignment.template_repo) throw new Error("Esta tarea no tiene un repositorio de plantilla configurado.");
    
    const repoName = `${assignment.title.replace(/\s+/g, '-')}-${profile.github_user}`;
    const orgName = course.github_org;
    
    const githubHeaders = {
        'Authorization': `token ${githubToken}`,
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
            }).catch(e => logger.error("Webhook error:", e));
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
        // Solo se guardan parámetros LTI con un outcome service externo válido.
        moodle_lis_outcome_service_url: isSafeExternalUrl(payload.moodle_lis_outcome_service_url) ? payload.moodle_lis_outcome_service_url : '',
        moodle_lis_result_sourcedid: isSafeExternalUrl(payload.moodle_lis_outcome_service_url) ? String(payload.moodle_lis_result_sourcedid || '').slice(0, 512) : '',
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
    const token = courseGithubToken(aSnap.data().course_id, cSnap.data());
    if (!token) throw new Error("El profesor no configuró el token de GitHub.");

    const cleanRepoUrl = (sub.repo_url || '').trim().replace(/\/$/, '').replace(/\.git$/, '');
    const repoParts = cleanRepoUrl.replace(/^https?:\/\/github\.com\//, '').split('/');
    const owner = repoParts[0];
    const repoName = repoParts[1];
    
    if (!owner || !repoName) throw new Error("URL de repositorio de GitHub no válida.");
    
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
        logger.error("Error fetching commits:", e);
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
        logger.error("Error fetching pull requests:", e);
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
        logger.error("Error fetching repo comments:", e);
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
    const token = courseGithubToken(aSnap.data().course_id, cSnap.data());
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

/**
 * ¿Una entrega hecha en `nowMs` queda fuera de término? Considera la
 * tolerancia de las reglas de la comisión y las prórrogas individuales.
 */
async function submissionLateness(db, assignmentId, studentId, nowMs) {
    const aSnap = await db.collection('assignments').doc(assignmentId).get();
    if (!aSnap.exists) return { late: false, lateByHours: 0 };
    const assignment = aSnap.data();
    const courseId = assignment.course_id;
    const [cSnap, pSnap, exSnap] = await Promise.all([
        db.collection('courses').doc(courseId).get(),
        db.collection('profiles').doc(studentId).get(),
        db.collection('course_exceptions').where('course_id', '==', courseId).where('student_id', '==', studentId).get(),
    ]);
    const profile = pSnap.exists ? pSnap.data() : {};
    const rules = resolveRules(cSnap.exists ? cSnap.data() : {}, profile.commissions && profile.commissions[courseId]);
    const extension = exSnap.docs.map((d) => d.data())
        .filter((e) => !e.revoked && e.type === 'deadline_extension' && e.assignment_id === assignmentId)
        .reduce((sum, e) => sum + (Number(e.extra_hours) || 0), 0);
    return lateness(nowMs, assignment.due_date, rules.late_tolerance_hours, extension);
}

async function submitAssignment(payload, context) {
    const { uid, db, admin } = context;
    const sSnap = await db.collection('submissions').doc(payload.submissionId).get();
    if (!sSnap.exists || sSnap.data().student_id !== uid) throw new Error("Entrega no encontrada o no autorizada");

    const { late, lateByHours } = await submissionLateness(db, sSnap.data().assignment_id, uid, Date.now());
    await sSnap.ref.update({
        status: 'submitted',
        student_message: payload.message || '',
        submitted_at: admin.firestore.FieldValue.serverTimestamp(),
        late,
        late_by_hours: lateByHours
    });
    
    return { success: true, late };
}

async function updateAssignment(payload, context) {
    const { db } = context;
    const ref = db.collection('assignments').doc(payload.assignmentId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error("La tarea no existe");

    // Solo campos editables: course_id, sync_secret o peer_review no se
    // pueden sobrescribir desde el formulario de edición.
    const data = payload.data && typeof payload.data === 'object' ? payload.data : {};
    const editable = Object.fromEntries(Object.entries(data).filter(([key]) => EDITABLE_ASSIGNMENT_FIELDS.includes(key)));
    const dataToUpdate = await sanitizeAssignmentFields(editable, { db, courseId: snap.data().course_id, partial: true });
    if (Object.keys(dataToUpdate).length === 0) throw invalid('No hay cambios válidos para guardar.');

    await ref.update(dataToUpdate);
    return { success: true };
}

async function syncGradesFromSpreadsheet(payload, context) {
    const { db, admin, uid } = context;
    const assignmentId = payload.assignmentId;
    const sheetUrl = payload.sheetUrl;
    const assignmentSnap = await db.collection('assignments').doc(assignmentId).get();
    if (!assignmentSnap.exists) throw new HttpsError('not-found', 'No se encontró el trabajo práctico.');
    const courseId = assignmentSnap.data().course_id;
    await assertCanEditStudents(db, courseId, uid, []);
    const scope = await staffCommissionScope(db, courseId, uid);
    
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
    const rejectedRows = [];
    const batch = db.batch();
    
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row[matriculaIdx]) continue;
        
        const matricula = row[matriculaIdx];
        const normalized = normalizeGrade(row[notaIdx]);
        if (!normalized.ok) {
            rejectedRows.push({ row: i + 1, matricula, reason: normalized.error });
            continue;
        }
        const nota = normalized.value;
        const feedback = normalizeFeedback(feedbackIdx !== -1 ? row[feedbackIdx] : '');
        
        if (!nota && !feedback) continue;
        
        const pSnap = await db.collection('profiles').where('matricula_unrn', '==', matricula).get();
        if (pSnap.empty) continue;
        
        const studentId = pSnap.docs[0].id;
        // Solo alumnos del padrón de esta cursada y, para un ayudante, de sus comisiones.
        const rosterSnap = await db.collection('course_roster').doc(`${courseId}_${studentId}`).get();
        if (!rosterSnap.exists || rosterSnap.data().status === 'removed') {
            rejectedRows.push({ row: i + 1, matricula, reason: 'No está en el padrón de la cursada.' });
            continue;
        }
        if ((await outOfScope(db, courseId, scope, [studentId])).length > 0) {
            rejectedRows.push({ row: i + 1, matricula, reason: 'Pertenece a una comisión que no tenés asignada.' });
            continue;
        }
        
        const sSnap = await db.collection('submissions')
            .where('assignment_id', '==', assignmentId)
            .where('student_id', '==', studentId)
            .get();
            
        if (!sSnap.empty) {
            batch.update(sSnap.docs[0].ref, { grade: nota, feedback: feedback, graded_at: admin.firestore.FieldValue.serverTimestamp() });
        } else {
            const newSubRef = db.collection('submissions').doc(`${assignmentId}_${studentId}`);
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
    return { success: true, updatedCount, rejectedRows };
}

async function addGroupCollaborator(payload, context) {
    const { uid, db, admin } = context;
    const subSnap = await db.collection('submissions').doc(payload.submissionId).get();
    if (!subSnap.exists) throw new Error("Entrega no encontrada");
    const sub = subSnap.data();

    // La tarea sale siempre de la entrega: un assignmentId distinto en el
    // payload permitiría usar el token de GitHub de otra cátedra.
    const assignmentId = sub.assignment_id;
    if (payload.assignmentId && payload.assignmentId !== assignmentId) {
        throw new Error("La entrega no pertenece a la tarea indicada");
    }
    const assignmentSnap = await db.collection('assignments').doc(assignmentId).get();
    if (!assignmentSnap.exists) throw new Error("La tarea no existe");
    const assignment = assignmentSnap.data();

    if (sub.student_id !== uid && !(await isCourseStaff(db, assignment.course_id, uid))) {
        throw new Error("Solo el autor de la entrega o un docente del curso pueden sumar integrantes");
    }
    
    const pSnap = await db.collection('profiles').where('email', '==', payload.email).get();
    if (pSnap.empty) throw new Error("No se encontró ningún estudiante registrado con ese correo");
    const newStudent = pSnap.docs[0].data();
    const newStudentId = pSnap.docs[0].id;
    
    if (!newStudent.github_user) throw new Error("El estudiante no configuró su usuario de GitHub en el perfil");
    if (!(await isCourseMember(db, assignment.course_id, newStudentId))) {
        throw new Error("El estudiante no está inscripto en este curso");
    }
    
    const courseSnap = await db.collection('courses').doc(assignment.course_id).get();
    const githubToken = courseGithubToken(assignment.course_id, courseSnap.data());
    if (!githubToken) throw new Error("El profesor aún no ha configurado el token de GitHub para esta materia.");
    
    const parts = sub.repo_url.split('/');
    const orgName = parts[parts.length - 2];
    const repoName = parts[parts.length - 1];
    
    const addRes = await fetch(`https://api.github.com/repos/${orgName}/${repoName}/collaborators/${newStudent.github_user}`, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${githubToken}`,
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
    
    await db.collection('submissions').doc(`${assignmentId}_${newStudentId}`).set({
        assignment_id: assignmentId,
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
    addGroupCollaborator,
    submissionLateness
};
