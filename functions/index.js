const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { beforeUserCreated } = require("firebase-functions/v2/identity");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();

exports.beforeUserCreated = beforeUserCreated(async (event) => {
    const user = event.data;
    let role = 'student';
    if (user.email === 'admin@jutsu.com' || user.email === 'admin@gaula.com' || user.email === 'admin@dojo.com') role = 'admin';
    if (user.email === 'teacher@jutsu.com' || user.email === 'teacher@gaula.com' || user.email === 'teacher@dojo.com') role = 'teacher';

    const profileData = {
        id: user.uid,
        full_name: user.displayName || (user.email ? user.email.split('@')[0] : 'User'),
        email: user.email,
        role: role,
        avatar_url: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}`,
        account_status: role === 'student' ? 'pending' : 'approved',
        created_at: admin.firestore.FieldValue.serverTimestamp()
    };
    try {
        await db.collection('profiles').doc(user.uid).set(profileData, { merge: true });
    } catch (e) {
        console.error(`Error creating profile for user ${user.uid}:`, e);
    }
});

async function syncGradeToMoodle(previousData, grade, feedback) {
    if (!previousData.moodle_lis_outcome_service_url || !previousData.moodle_lis_result_sourcedid) {
        console.log("No Moodle LTI sync parameters found for submission:", previousData.id || "unknown");
        return;
    }

    // Verify if Moodle integration is enabled for this course
    if (previousData.assignment_id) {
        try {
            const assignmentDoc = await db.collection('assignments').doc(previousData.assignment_id).get();
            if (assignmentDoc.exists) {
                const assignment = assignmentDoc.data();
                const courseDoc = await db.collection('courses').doc(assignment.course_id).get();
                if (courseDoc.exists) {
                    const course = courseDoc.data();
                    if (!course.moodle_enabled) {
                        console.log("Moodle integration is disabled for this course:", course.name);
                        return;
                    }
                }
            }
        } catch (e) {
            console.error("Error verifying moodle_enabled setting in course:", e);
        }
    }

    const outcomeUrl = previousData.moodle_lis_outcome_service_url;
    const sourcedId = previousData.moodle_lis_result_sourcedid;

    // Convert grade to standard decimal (0.0 to 1.0)
    let numericGrade = parseFloat(grade);
    if (isNaN(numericGrade)) {
        numericGrade = 0.0;
    } else {
        // If grade is out of 10, normalize to 1.0
        if (numericGrade > 1.0) {
            numericGrade = numericGrade / 10.0;
        }
    }
    if (numericGrade > 1.0) numericGrade = 1.0;
    if (numericGrade < 0.0) numericGrade = 0.0;

    console.log(`Sincronizando nota ${numericGrade} con Moodle URL: ${outcomeUrl}`);

    const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<imsx_POXEnvelopeRequest xmlns="http://www.imsglobal.org/services/ltiv1p1/xsd/imsoms_v1p0">
  <imsx_POXHeader>
    <imsx_POXRequestHeaderInfo>
      <imsx_version>V1.0</imsx_version>
      <imsx_messageIdentifier>${Date.now()}</imsx_messageIdentifier>
    </imsx_POXRequestHeaderInfo>
  </imsx_POXHeader>
  <imsx_POXBody>
    <replaceResultRequest>
      <resultRecord>
        <sourcedGUID>
          <sourcedId>${sourcedId}</sourcedId>
        </sourcedGUID>
        <result>
          <resultScore>
            <language>es</language>
            <textString>${numericGrade.toFixed(2)}</textString>
          </resultScore>
        </result>
      </resultRecord>
    </replaceResultRequest>
  </imsx_POXBody>
</imsx_POXEnvelopeRequest>`;

    try {
        const fetch = require('node-fetch');
        const response = await fetch(outcomeUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/xml',
                'Authorization': 'OAuth realm=""'
            },
            body: xmlPayload
        });
        
        const resText = await response.text();
        console.log("Respuesta de sincronización con Moodle:", response.status, resText);
        
        await db.collection('audit_logs').add({
            action: 'moodle_grade_sync',
            submission_id: previousData.id || '',
            status: response.ok ? 'success' : 'failure',
            status_code: response.status,
            grade: String(grade),
            normalized_grade: numericGrade,
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (err) {
        console.error("Error al sincronizar nota con Moodle:", err);
    }
}

const actionModules = {
    // profile
    getProfile: 'profile',
    updateProfile: 'profile',
    submitMatricula: 'profile',
    
    // admin
    approveUser: 'admin',
    updateUserRole: 'admin',
    updateUserProfile: 'admin',
    getAdminUsers: 'admin',
    getAdminCourses: 'admin',
    getGlobalSettings: 'admin',
    saveGlobalSettings: 'admin',
    getAdminCourseDetails: 'admin',
    deleteUser: 'admin',
    
    // attendance
    markAttendance: 'attendance',
    submitQrAttendance: 'attendance',
    
    // moodle
    moodleAutoEnroll: 'moodle',
    
    // courses
    getCourseDetails: 'courses',
    enrollCourse: 'courses',
    createCourse: 'courses',
    updateCourseName: 'courses',
    getCourseTeachers: 'courses',
    assignTeacher: 'courses',
    removeTeacher: 'courses',
    getTeacherCourses: 'courses',
    getCourseSettings: 'courses',
    updateCourseSettings: 'courses',
    cloneCourseExtraData: 'courses',
    getStudentCourses: 'courses',
    getCourseRoster: 'courses',
    
    // schedule
    saveScheduleVersion: 'schedule',
    getScheduleVersions: 'schedule',
    restoreScheduleVersion: 'schedule',
    getComparisonCourses: 'schedule',
    
    // studyGroups
    createStudyGroup: 'studyGroups',
    joinStudyGroup: 'studyGroups',
    leaveStudyGroup: 'studyGroups',
    getStudyGroups: 'studyGroups',
    findStudyBuddies: 'studyGroups',
    
    // tutoring
    registerAsTutor: 'tutoring',
    getCourseTutors: 'tutoring',
    bookTutoringSession: 'tutoring',
    getTutoringSessions: 'tutoring',
    updateTutoringSessionStatus: 'tutoring',
    
    // notifications
    notifyCourseStudents: 'notifications',
    checkAndAlertStudentsAtRisk: 'notifications',
    getStudentNotifications: 'notifications',
    markNotificationsRead: 'notifications',
    
    // backups
    createSystemBackup: 'backups',
    getSystemBackups: 'backups',
    restoreBackupDocument: 'backups',
    downloadSystemBackup: 'backups',
    
    // announcements
    createAnnouncement: 'announcements',
    getTeacherAnnouncements: 'announcements',
    getStudentAnnouncements: 'announcements',
    acknowledgeAnnouncement: 'announcements',
    getAnnouncementAcknowledgements: 'announcements',
    
    // stats
    getTeacherDashboardStats: 'stats',
    getCourseDashboardStats: 'stats',
    
    // assignments
    archiveAssignment: 'assignments',
    getTeacherAssignments: 'assignments',
    createAssignment: 'assignments',
    getAssignmentSubmissions: 'assignments',
    toggleAccess: 'assignments',
    massToggleAccess: 'assignments',
    gradeSubmission: 'assignments',
    getStudentAssignments: 'assignments',
    acceptAssignment: 'assignments',
    getStudentGithubActivity: 'assignments',
    getStudentCommits: 'assignments',
    submitAssignment: 'assignments',
    updateAssignment: 'assignments',
    syncGradesFromSpreadsheet: 'assignments',
    addGroupCollaborator: 'assignments',
};

exports.api = onCall(async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be logged in.');
    const uid = request.auth.uid;
    const { action, payload } = request.data;
    
    const getMyProfile = async () => (await db.collection('profiles').doc(uid).get()).data();
    
    try {
        const moduleName = actionModules[action];
        if (!moduleName) throw new HttpsError('invalid-argument', `Acción desconocida: ${action}`);
        
        const modulePath = `./actions/${moduleName}`;
        const actionModule = require(modulePath);
        
        const handler = actionModule[action];
        if (typeof handler !== 'function') {
            throw new HttpsError('internal', `El manejador para ${action} no está implementado en ${moduleName}`);
        }
        
        const context = {
            uid,
            request,
            db,
            admin,
            getMyProfile,
            syncGradeToMoodle
        };
        
        return await handler(payload, context);
    } catch (e) {
        throw new HttpsError('internal', e.message);
    }
});

exports.calendar = onRequest(async (req, res) => {
    const courseId = req.query.id;
    if (!courseId) return res.status(400).send('Falta el ID del curso');
    
    try {
        const cSnap = await db.collection('courses').doc(courseId).get();
        if (!cSnap.exists) return res.status(404).send('Curso no encontrado');
        
        const course = cSnap.data();
        
        let ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Jutsu Classroom//ES\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\nX-WR-CALNAME:" + (course.name || "Cursada") + "\r\n";
        
        if (course.class_instances && course.class_instances.length > 0) {
            course.class_instances.forEach((ci, idx) => {
                if (ci.special_status === 'Feriado') return;
                
                const formatICSDate = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                
                const startDt = new Date(ci.date);
                const endDt = new Date(startDt.getTime() + 2 * 3600000);
                
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
                    const fetch = require('node-fetch');
                    const response = await fetch(url);
                    if (response.ok) {
                        const externalIcs = await response.text();
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

exports.webhook = onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.status(204).send('');
        return;
    }

    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
    
    const { assignmentId, sync_secret, grades } = req.body;
    if (!assignmentId || !sync_secret || !grades) {
        return res.status(400).send('Faltan parametros requeridos');
    }
    
    try {
        const aSnap = await db.collection('assignments').doc(assignmentId).get();
        if (!aSnap.exists) return res.status(404).send('Assignment not found');
        const assignment = aSnap.data();
        
        if (assignment.sync_secret !== sync_secret) {
            return res.status(401).send('Invalid secret');
        }
        
        const batch = db.batch();
        let updatedCount = 0;
        
        for (const g of grades) {
            if (!g.matricula || (!g.grade && !g.feedback)) continue;
            
            const pSnap = await db.collection('profiles').where('matricula_unrn', '==', g.matricula).get();
            if (pSnap.empty) continue;
            
            const studentId = pSnap.docs[0].id;
            const sSnap = await db.collection('submissions').where('assignment_id', '==', assignmentId).where('student_id', '==', studentId).get();
            
            if (!sSnap.empty) {
                batch.update(sSnap.docs[0].ref, {
                    grade: String(g.grade || ''),
                    feedback: String(g.feedback || ''),
                    graded_at: admin.firestore.FieldValue.serverTimestamp()
                });
                updatedCount++;
            } else {
                const subRef = db.collection('submissions').doc();
                batch.set(subRef, {
                    assignment_id: assignmentId,
                    student_id: studentId,
                    repo_url: '',
                    grade: String(g.grade || ''),
                    feedback: String(g.feedback || ''),
                    is_locked: false,
                    graded_at: admin.firestore.FieldValue.serverTimestamp(),
                    created_at: admin.firestore.FieldValue.serverTimestamp()
                });
                updatedCount++;
            }
        }
        await batch.commit();
        res.json({ success: true, updatedCount });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

exports.exportGradesCsv = onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    
    try {
        const { courseId, token } = req.query;
        if (!courseId || !token) return res.status(400).send("Falta courseId o token");

        const cSnap = await db.collection('courses').doc(courseId).get();
        if (!cSnap.exists) return res.status(404).send("Materia no encontrada");
        const course = cSnap.data();

        if (course.sync_secret !== token) return res.status(401).send("Token inválido");

        const aSnap = await db.collection('assignments').where('course_id', '==', courseId).get();
        const assignmentsMap = {};
        aSnap.docs.forEach(d => assignmentsMap[d.id] = d.data());
        
        let csv = "timestamp;id_entrega;email;practica-usuario;url_repositorio;comentarios_entrega;materia;practica;usuario_github\n";
        
        for (const aId of Object.keys(assignmentsMap)) {
            const assignment = assignmentsMap[aId];
            const sSnap = await db.collection('submissions').where('assignment_id', '==', aId).get();
            
            for (const doc of sSnap.docs) {
                const sub = doc.data();
                const pSnap = await db.collection('profiles').doc(sub.student_id).get();
                const profile = pSnap.exists ? pSnap.data() : {};
                
                const timestamp = sub.created_at ? sub.created_at.toDate().toISOString() : '';
                const email = profile.contact_email || profile.email || '';
                const practicaUsuario = `${assignment.title} - ${profile.full_name || ''}`;
                const urlRepo = sub.repo_url || '';
                const comentarios = sub.feedback || '';
                const materia = course.name;
                const practica = assignment.title;
                const usuarioGithub = profile.github_username || '';

                const escapeCsv = (str) => {
                    if (typeof str !== 'string') return '';
                    if (str.includes(';') || str.includes('"') || str.includes('\n')) {
                        return `"${str.replace(/"/g, '""')}"`;
                    }
                    return str;
                };

                csv += `${timestamp};${doc.id};${escapeCsv(email)};${escapeCsv(practicaUsuario)};${escapeCsv(urlRepo)};${escapeCsv(comentarios)};${escapeCsv(materia)};${escapeCsv(practica)};${escapeCsv(usuarioGithub)}\n`;
            }
        }

        res.set('Content-Type', 'text/csv; charset=utf-8');
        res.set('Content-Disposition', `attachment; filename="export_${courseId}.csv"`);
        res.status(200).send(csv);

    } catch (e) {
        console.error(e);
        res.status(500).send("Error interno: " + e.message);
    }
});

exports.importGrades = onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(204).send('');
    }
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { courseId, token } = req.query;
        if (!courseId || !token) return res.status(400).send("Falta courseId o token");

        const cSnap = await db.collection('courses').doc(courseId).get();
        if (!cSnap.exists) return res.status(404).send("Materia no encontrada");
        const course = cSnap.data();

        if (course.sync_secret !== token) return res.status(401).send("Token inválido");

        let rows = [];
        const contentType = req.headers['content-type'] || '';
        
        if (contentType.includes('application/json')) {
            rows = req.body;
            if (!Array.isArray(rows)) return res.status(400).send("JSON debe ser un array");
        } else if (contentType.includes('text/csv')) {
            const csvText = req.body.toString('utf8');
            const lines = csvText.split('\n').filter(l => l.trim().length > 0);
            if (lines.length < 2) return res.status(400).send("CSV vacío o sin encabezados");
            
            const headerLine = lines[0];
            const separator = headerLine.includes(';') ? ';' : ',';
            
            const headers = headerLine.split(separator).map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
            
            const idIdx = headers.findIndex(h => h.includes('id_entrega'));
            const resIdx = headers.findIndex(h => h.includes('resultado') || h.includes('nota'));
            const comIdx = headers.findIndex(h => h.includes('comentario'));
            
            if (idIdx === -1) return res.status(400).send("El CSV debe tener columna 'id_entrega'");
            
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(separator).map(c => c.trim().replace(/^"|"$/g, ''));
                rows.push({
                    id_entrega: cols[idIdx],
                    resultado: resIdx !== -1 ? cols[resIdx] : '',
                    comentario_general: comIdx !== -1 ? cols[comIdx] : ''
                });
            }
        } else {
            return res.status(400).send("Content-Type debe ser application/json o text/csv");
        }

        const batch = db.batch();
        let updatedCount = 0;

        for (const row of rows) {
            const { id_entrega, resultado, comentario_general } = row;
            if (!id_entrega) continue;
            if (!resultado && !comentario_general) continue;

            const subRef = db.collection('submissions').doc(id_entrega);
            const subSnap = await subRef.get();
            if (subSnap.exists) {
                batch.update(subRef, {
                    grade: String(resultado || ''),
                    feedback: String(comentario_general || ''),
                    graded_at: admin.firestore.FieldValue.serverTimestamp()
                });
                
                const studentId = subSnap.data().student_id;
                let is_daily_pending = false;
                const pSnap = await db.collection('profiles').doc(studentId).get();
                if (pSnap.exists && pSnap.data().notification_pref === 'daily_summary') {
                    is_daily_pending = true;
                }
                
                const notifRef = db.collection('notifications').doc();
                batch.set(notifRef, {
                    student_id: studentId,
                    message: `Tu entrega ha sido corregida. ${resultado ? 'Nota: ' + resultado : ''}`,
                    link: '/estudiante/tareas',
                    read: false,
                    is_daily_pending,
                    created_at: admin.firestore.FieldValue.serverTimestamp()
                });
                updatedCount++;
            }
        }

        await batch.commit();
        res.status(200).send({ success: true, updatedCount });

    } catch (e) {
        console.error(e);
        res.status(500).send("Error interno: " + e.message);
    }
});

exports.sendDailySummaries = onSchedule({ schedule: 'every day 20:00', timeZone: 'America/Argentina/Buenos_Aires' }, async (event) => {
    try {
        const snap = await db.collection('notifications').where('is_daily_pending', '==', true).get();
        if (snap.empty) return null;
        
        const byStudent = {};
        for (let doc of snap.docs) {
            const data = doc.data();
            const studentId = data.student_id;
            if (!byStudent[studentId]) byStudent[studentId] = [];
            byStudent[studentId].push({ id: doc.id, ...data });
        }
        
        const promises = [];
        for (const [studentId, notifs] of Object.entries(byStudent)) {
            const batch = db.batch();
            
            for (const n of notifs) {
                batch.delete(db.collection('notifications').doc(n.id));
            }
            
            const summaryRef = db.collection('notifications').doc();
            batch.set(summaryRef, {
                student_id: studentId,
                message: `Resumen Diario: Tenés ${notifs.length} nuevas actualizaciones (calificaciones, cambios de clase, etc.)`,
                link: '/estudiante/notificaciones',
                read: false,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });
            
            promises.push(batch.commit());
        }
        
        await Promise.all(promises);
        console.log(`Sent daily summaries to ${Object.keys(byStudent).length} students.`);
    } catch (e) {
        console.error('Error sending daily summaries:', e);
    }
    return null;
});
