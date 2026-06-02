const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();

exports.onUserCreated = functions.auth.user().onCreate(async (user) => {
    let role = 'student';
    if (user.email === 'admin@jutsu.com' || user.email === 'admin@gaula.com') role = 'admin';
    if (user.email === 'teacher@jutsu.com' || user.email === 'teacher@gaula.com') role = 'teacher';

    const profileData = {
        id: user.uid,
        full_name: user.displayName || (user.email ? user.email.split('@')[0] : 'User'),
        email: user.email,
        role: role,
        avatar_url: user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || 'User'}`,
        created_at: admin.firestore.FieldValue.serverTimestamp()
    };
    await db.collection('profiles').doc(user.uid).set(profileData);
});

exports.api = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in.');
    const uid = context.auth.uid;
    const { action, payload } = data;
    
    // Helper to get user profile
    const getMyProfile = async () => (await db.collection('profiles').doc(uid).get()).data();
    
    try {
        if (action === 'getProfile') {
            return await getMyProfile();
        }
        
        if (action === 'updateProfile') {
            await db.collection('profiles').doc(uid).update(payload);
            return { success: true };
        }
        
        if (action === 'getAdminUsers') {
            const snap = await db.collection('profiles').orderBy('full_name').get();
            return snap.docs.map(d => d.data());
        }
        
        if (action === 'updateUserProfile') {
            await db.collection('profiles').doc(payload.userId).update(payload.data);
            return { success: true };
        }

        if (action === 'getAdminCourses') {
            const coursesSnap = await db.collection('courses').orderBy('created_at', 'desc').get();
            const courses = [];
            for (let doc of coursesSnap.docs) {
                const c = { id: doc.id, ...doc.data() };
                const teachersSnap = await db.collection('course_teachers').where('course_id', '==', c.id).get();
                c.course_teachers = [];
                for (let tdoc of teachersSnap.docs) {
                    const tdata = tdoc.data();
                    const profSnap = await db.collection('profiles').doc(tdata.teacher_id).get();
                    c.course_teachers.push({
                        teacher_id: tdata.teacher_id,
                        profiles: profSnap.data()
                    });
                }
                courses.push(c);
            }
            return courses;
        }

        if (action === 'getAdminCourseDetails') {
            const courseId = payload.courseId;
            const cSnap = await db.collection('courses').doc(courseId).get();
            if (!cSnap.exists) throw new Error("Course not found");
            const course = cSnap.data();
            course.id = courseId;
            
            // Get teachers
            const tSnap = await db.collection('course_teachers').where('course_id', '==', courseId).get();
            course.teachers = [];
            for (let doc of tSnap.docs) {
                const tdata = doc.data();
                const pSnap = await db.collection('profiles').doc(tdata.teacher_id).get();
                course.teachers.push(pSnap.data());
            }
            
            // Get students
            const rSnap = await db.collection('course_roster').where('course_id', '==', courseId).get();
            course.students = [];
            for (let doc of rSnap.docs) {
                const sdata = doc.data();
                const pSnap = await db.collection('profiles').doc(sdata.student_id).get();
                course.students.push(pSnap.data());
            }

            // Get assignments
            const aSnap = await db.collection('assignments').where('course_id', '==', courseId).get();
            course.assignments = aSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            return course;
        }

        if (action === 'enrollCourse') {
            const code = payload.code.trim();
            const snap = await db.collection('courses').where('invite_code', '==', code).get();
            if (snap.empty) throw new Error("Course not found with that code");
            const courseId = snap.docs[0].id;
            await db.collection('course_roster').doc(`${courseId}_${uid}`).set({
                course_id: courseId,
                student_id: uid,
                enrolled_at: admin.firestore.FieldValue.serverTimestamp()
            });
            return { success: true };
        }

        if (action === 'createCourse') {
            const ref = await db.collection('courses').add({
                name: payload.name,
                github_org: payload.github_org,
                invite_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
                created_by: uid,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });
            return { id: ref.id };
        }
        
        if (action === 'updateCourseName') {
            await db.collection('courses').doc(payload.courseId).update({ name: payload.name });
            return { success: true };
        }
        
        if (action === 'getCourseTeachers') {
            const tSnap = await db.collection('course_teachers').where('course_id', '==', payload.courseId).get();
            const teachers = [];
            for (let doc of tSnap.docs) {
                const t = doc.data();
                const p = await db.collection('profiles').doc(t.teacher_id).get();
                teachers.push({ ...t, profiles: p.data() });
            }
            return teachers;
        }
        
        if (action === 'assignTeacher') {
            await db.collection('course_teachers').doc(`${payload.courseId}_${payload.teacherId}`).set({
                course_id: payload.courseId,
                teacher_id: payload.teacherId
            });
            return { success: true };
        }
        
        if (action === 'removeTeacher') {
            await db.collection('course_teachers').doc(`${payload.courseId}_${payload.teacherId}`).delete();
            return { success: true };
        }
        
        if (action === 'getTeacherCourses') {
            const snap = await db.collection('course_teachers').where('teacher_id', '==', uid).get();
            const courses = [];
            for (let doc of snap.docs) {
                const cSnap = await db.collection('courses').doc(doc.data().course_id).get();
                if(cSnap.exists) courses.push({ id: cSnap.id, ...cSnap.data() });
            }
            return courses;
        }

        if (action === 'getCourseSettings') {
            const courseId = payload.courseId;
            const accessSnap = await db.collection('course_teachers').doc(`${courseId}_${uid}`).get();
            if (!accessSnap.exists) throw new Error("No tienes acceso a este curso");
            
            const cSnap = await db.collection('courses').doc(courseId).get();
            return { id: cSnap.id, ...cSnap.data() };
        }

        if (action === 'updateCourseSettings') {
            const courseId = payload.courseId;
            const accessSnap = await db.collection('course_teachers').doc(`${courseId}_${uid}`).get();
            if (!accessSnap.exists) throw new Error("No tienes acceso a este curso");
            
            await db.collection('courses').doc(courseId).update(payload.data);
            return { success: true };
        }

        if (action === 'getTeacherAssignments') {
            const tSnap = await db.collection('course_teachers').where('teacher_id', '==', uid).get();
            const courseIds = tSnap.docs.map(d => d.data().course_id);
            if (courseIds.length === 0) return [];
            
            // Cannot 'in' with > 10, but assuming few courses for demo
            const aSnap = await db.collection('assignments').where('course_id', 'in', courseIds).get();
            return aSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
        
        if (action === 'createAssignment') {
            await db.collection('assignments').add({
                ...payload,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });
            return { success: true };
        }
        
        if (action === 'getAssignmentSubmissions') {
            const snap = await db.collection('submissions').where('assignment_id', '==', payload.assignmentId).get();
            const subs = [];
            for (let doc of snap.docs) {
                const s = doc.data();
                const p = await db.collection('profiles').doc(s.student_id).get();
                subs.push({ id: doc.id, ...s, profiles: p.data() });
            }
            return subs;
        }

        if (action === 'toggleAccess') {
            await db.collection('submissions').doc(payload.submissionId).update({ is_locked: payload.lock });
            return { success: true };
        }
        
        if (action === 'massToggleAccess') {
            const subs = await db.collection('submissions').where('assignment_id', '==', payload.assignmentId).get();
            const batch = db.batch();
            subs.forEach(doc => batch.update(doc.ref, { is_locked: payload.lock }));
            await batch.commit();
            return { success: true };
        }
        
        if (action === 'getStudentCourses') {
            const snap = await db.collection('course_roster').where('student_id', '==', uid).get();
            const courses = [];
            for (let doc of snap.docs) {
                const cSnap = await db.collection('courses').doc(doc.data().course_id).get();
                if(cSnap.exists) courses.push({ id: cSnap.id, ...cSnap.data() });
            }
            return courses;
        }

        if (action === 'getCourseRoster') {
            const snap = await db.collection('course_roster').where('course_id', '==', payload.courseId).get();
            const students = [];
            for (let doc of snap.docs) {
                const pSnap = await db.collection('profiles').doc(doc.data().student_id).get();
                if(pSnap.exists) students.push(pSnap.data());
            }
            return students;
        }

        if (action === 'getStudentAssignments') {
            const courseIds = payload.courseIds || [];
            if (courseIds.length === 0) return { assignments: [], submissions: [] };
            
            const snap = await db.collection('assignments').where('course_id', 'in', courseIds).get();
            const assignments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            const subsSnap = await db.collection('submissions').where('student_id', '==', uid).get();
            const submissions = subsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            return { assignments, submissions };
        }

        if (action === 'acceptAssignment') {
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
            
            const subRef = db.collection('submissions').doc();
            await subRef.set({
                assignment_id: assignmentId,
                student_id: uid,
                repo_url: `https://github.com/${orgName}/${repoName}`,
                grade: '',
                feedback: '',
                is_locked: false,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });
            
            return { success: true, repoUrl: `https://github.com/${orgName}/${repoName}` };
        }

        if (action === 'updateAssignment') {
            await db.collection('assignments').doc(payload.assignmentId).update(payload.data);
            return { success: true };
        }

        if (action === 'syncGradesFromSpreadsheet') {
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


    } catch (e) {
        throw new functions.https.HttpsError('internal', e.message);
    }
});

exports.calendar = functions.https.onRequest(async (req, res) => {
    const courseId = req.query.id;
    if (!courseId) return res.status(400).send('Falta el ID del curso');
    
    try {
        const cSnap = await db.collection('courses').doc(courseId).get();
        if (!cSnap.exists) return res.status(404).send('Curso no encontrado');
        
        const course = cSnap.data();
        
        let ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Jutsu Classroom//ES\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\nX-WR-CALNAME:" + (course.name || "Cursada") + "\r\n";
        
        if (course.class_instances && course.class_instances.length > 0) {
            course.class_instances.forEach((ci, idx) => {
                if (ci.special_status === 'Feriado') return; // Do not emit event for cancelled/holiday classes
                
                const formatICSDate = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                
                const startDt = new Date(ci.date);
                const endDt = new Date(startDt.getTime() + 2 * 3600000); // Assume 2 hours
                
                let title = `${course.name} - ${ci.type}`;
                if (ci.special_status === 'Examen') title = `[EXAMEN] ${title}`;
                if (ci.special_status === 'Clase Remota') title = `[REMOTA] ${title}`;
                
                let desc = ci.topic ? `Tema: ${ci.topic}\\n` : "";
                if (ci.presentation_url) desc += `Presentación: ${ci.presentation_url}\\n`;
                if (ci.recording_url) desc += `Grabación: ${ci.recording_url}\\n`;

                ics += "BEGIN:VEVENT\r\n";
                ics += `UID:course_${courseId}_ci_${idx}@jutsu.classroom\r\n`;
                ics += `DTSTAMP:${formatICSDate(new Date())}\r\n`;
                ics += `DTSTART:${formatICSDate(startDt)}\r\n`;
                ics += `DTEND:${formatICSDate(endDt)}\r\n`;
                ics += `SUMMARY:${title}\r\n`;
                if (desc) ics += `DESCRIPTION:${desc}\r\n`;
                ics += "END:VEVENT\r\n";
            });
        } else if (course.start_date && course.duration_weeks && course.schedules) {
            const startStr = course.start_date;
            const [y, m, d] = startStr.split('-').map(Number);
            const baseDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
            
            const dayMap = { 'Domingo': 0, 'Lunes': 1, 'Martes': 2, 'Miércoles': 3, 'Jueves': 4, 'Viernes': 5, 'Sábado': 6 };
            const rruleDayMap = { 0: 'SU', 1: 'MO', 2: 'TU', 3: 'WE', 4: 'TH', 5: 'FR', 6: 'SA' };

            course.schedules.forEach((sch, idx) => {
                const targetDay = dayMap[sch.day];
                if (targetDay === undefined) return;
                
                let currentDay = baseDate.getUTCDay();
                let diff = targetDay - currentDay;
                if (diff < 0) diff += 7;
                
                const firstClassDate = new Date(baseDate.getTime() + diff * 86400000);
                
                const [hh, mm] = (sch.time || "00:00").split(':').map(Number);
                firstClassDate.setUTCHours(hh, mm, 0);
                
                const endDate = new Date(firstClassDate.getTime() + 2 * 3600000);

                const formatICSDate = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

                ics += "BEGIN:VEVENT\r\n";
                ics += `UID:course_${courseId}_sch_${idx}@jutsu.classroom\r\n`;
                ics += `DTSTAMP:${formatICSDate(new Date())}\r\n`;
                ics += `DTSTART:${formatICSDate(firstClassDate)}\r\n`;
                ics += `DTEND:${formatICSDate(endDate)}\r\n`;
                ics += `RRULE:FREQ=WEEKLY;COUNT=${course.duration_weeks};BYDAY=${rruleDayMap[targetDay]}\r\n`;
                ics += `SUMMARY:${course.name} - ${sch.type}\r\n`;
                ics += `DESCRIPTION:Clase ${sch.type} de ${course.name}\r\n`;
                ics += "END:VEVENT\r\n";
            });
        }
        
        if (course.external_calendars && course.external_calendars.length > 0) {
            for (let url of course.external_calendars) {
                try {
                    const response = await fetch(url);
                    if (response.ok) {
                        const externalIcs = await response.text();
                        // Extract everything between BEGIN:VEVENT and END:VEVENT
                        const vevents = externalIcs.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/gi);
                        if (vevents) {
                            vevents.forEach(ev => {
                                ics += ev + "\r\n";
                            });
                        }
                    }
                } catch (err) {
                    console.error("Error fetching external calendar:", url, err);
                }
            }
        }
        
        ics += "END:VCALENDAR\r\n";
        
        res.set({
            'Content-Type': 'text/calendar; charset=utf-8',
            'Content-Disposition': `attachment; filename="cursada_${courseId}.ics"`,
            'Access-Control-Allow-Origin': '*'
        });
        res.send(ics);
    } catch (e) {
        res.status(500).send(e.message);
    }
});
