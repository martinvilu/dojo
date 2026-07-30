const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

exports.exportGradesCsv = async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    
    const db = getFirestore();

    try {
        const { courseId, token, type } = req.query;
        if (!courseId || !token) return res.status(400).send("Falta courseId o token");

        const cSnap = await db.collection('courses').doc(courseId).get();
        if (!cSnap.exists) return res.status(404).send("Materia no encontrada");
        const course = cSnap.data();

        if (course.sync_secret !== token) return res.status(401).send("Token inválido");

        if (type === 'attendance' || type === 'asistencia') {
            const rosterSnap = await db.collection('course_roster').where('course_id', '==', courseId).get();
            const studentIds = new Set();
            rosterSnap.docs.forEach(doc => {
                const data = doc.data();
                if (data.student_id) studentIds.add(data.student_id);
            });

            const enrollSnap = await db.collection('enrollments').get();
            enrollSnap.docs.forEach(doc => {
                if (doc.id.includes(`_${courseId}`)) {
                    const data = doc.data();
                    if (data.student_id) studentIds.add(data.student_id);
                }
            });

            const profilesMap = {};
            for (const sid of Array.from(studentIds)) {
                const pSnap = await db.collection('profiles').doc(sid).get();
                if (pSnap.exists) {
                    profilesMap[sid] = pSnap.data();
                }
            }

            const attCollSnap = await db.collection('courses').doc(courseId).collection('attendance').get();
            const globalAttSnap = await db.collection('attendance').where('course_id', '==', courseId).get();
            const escapeCsv = (str) => {
                if (typeof str !== 'string') return '';
                if (str.includes(';') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`;
                return str;
            };
            let attCsv = "timestamp;materia;clase;estudiante_email;estudiante_nombre;estudiante_matricula;usuario_github;estado\n";
            attCollSnap.docs.forEach(doc => {
                const data = doc.data();
                const classNum = data.classNumber || doc.id.replace('class_', '');
                const records = data.records || {};
                const timestamp = data.updated_at ? (data.updated_at.toDate ? data.updated_at.toDate().toISOString() : new Date(data.updated_at).toISOString()) : new Date().toISOString();
                for (const [sid, status] of Object.entries(records)) {
                    const profile = profilesMap[sid] || {};
                    const email = profile.email || profile.contact_email || '';
                    const name = profile.full_name || '';
                    const matricula = profile.matricula_unrn || '';
                    const githubUser = profile.github_username || profile.github_user || '';
                    attCsv += `${escapeCsv(timestamp)};${escapeCsv(course.name)};${escapeCsv(String(classNum))};${escapeCsv(email)};${escapeCsv(name)};${escapeCsv(matricula)};${escapeCsv(githubUser)};${escapeCsv(String(status))}\n`;
                }
            });
            globalAttSnap.docs.forEach(doc => {
                const data = doc.data();
                const sid = data.student_id;
                const classId = data.class_id || data.classNumber || '1';
                const timestamp = data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate().toISOString() : new Date(data.timestamp).toISOString()) : new Date().toISOString();
                const profile = profilesMap[sid] || {};
                const email = profile.email || profile.contact_email || '';
                const name = profile.full_name || '';
                const matricula = profile.matricula_unrn || '';
                const githubUser = profile.github_username || profile.github_user || '';
                attCsv += `${escapeCsv(timestamp)};${escapeCsv(course.name)};${escapeCsv(String(classId))};${escapeCsv(email)};${escapeCsv(name)};${escapeCsv(matricula)};${escapeCsv(githubUser)};presente\n`;
            });
            res.set('Content-Type', 'text/csv; charset=utf-8');
            res.set('Content-Disposition', `attachment; filename="asistencia_${course.name.replace(/\s+/g, '_')}.csv"`);
            return res.status(200).send(attCsv);
        }

        if (type === 'roster' || type === 'alertas' || type === 'alumnos') {
            const rosterSnap = await db.collection('course_roster').where('course_id', '==', courseId).get();
            const classes = course.class_instances || [];
            const totalClasses = classes.length || 1;

            const assignSnap = await db.collection('assignments').where('course_id', '==', courseId).get();
            const totalAssignments = assignSnap.docs.length || 1;

            const escapeCsv = (str) => {
                if (typeof str !== 'string') return '';
                if (str.includes(';') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`;
                return str;
            };

            let rosterCsv = "matricula;estudiante_nombre;estudiante_email;usuario_github;estado_roster;asistencia_porcentaje;entregas_completadas;estado_riesgo\n";

            for (const doc of rosterSnap.docs) {
                const rData = doc.data();
                const sid = rData.student_id;
                const pSnap = await db.collection('profiles').doc(sid).get();
                const profile = pSnap.exists ? pSnap.data() : {};

                const attSnap = await db.collection('attendance').where('course_id', '==', courseId).where('student_id', '==', sid).get();
                const presentCount = attSnap.docs.length;
                const attRatio = Math.round((presentCount / Math.max(totalClasses, 1)) * 100);

                const subSnap = await db.collection('submissions').where('student_id', '==', sid).get();
                const subCount = subSnap.docs.length;

                let isRisk = (attRatio < 75 && totalClasses >= 3) || (subCount < Math.ceil(totalAssignments * 0.5));
                let riskStr = isRisk ? "EN RIESGO" : "REGULAR";

                rosterCsv += `${escapeCsv(profile.matricula_unrn || '')};${escapeCsv(profile.full_name || '')};${escapeCsv(profile.email || '')};${escapeCsv(profile.github_username || profile.github_user || '')};${escapeCsv(rData.status || 'approved')};${attRatio}%;${subCount}/${totalAssignments};${riskStr}\n`;
            }

            res.set('Content-Type', 'text/csv; charset=utf-8');
            res.set('Content-Disposition', `attachment; filename="alumnos_alertas_${course.name.replace(/\s+/g, '_')}.csv"`);
            return res.status(200).send(rosterCsv);
        }

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
                
                const timestamp = sub.created_at ? (sub.created_at.toDate ? sub.created_at.toDate().toISOString() : new Date(sub.created_at).toISOString()) : '';
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
        logger.error("Error exporting grades CSV:", e);
        res.status(500).send("Error interno: " + e.message);
    }
};

exports.exportAttendanceCsv = async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    
    const db = getFirestore();

    try {
        const { courseId, token } = req.query;
        if (!courseId || !token) return res.status(400).send("Falta courseId o token");

        const cSnap = await db.collection('courses').doc(courseId).get();
        if (!cSnap.exists) return res.status(404).send("Materia no encontrada");
        const course = cSnap.data();

        if (course.sync_secret !== token) return res.status(401).send("Token inválido");

        const rosterSnap = await db.collection('course_roster').where('course_id', '==', courseId).get();
        const studentIds = new Set();
        rosterSnap.docs.forEach(doc => {
            const data = doc.data();
            if (data.student_id) studentIds.add(data.student_id);
        });

        const enrollSnap = await db.collection('enrollments').get();
        enrollSnap.docs.forEach(doc => {
            if (doc.id.includes(`_${courseId}`)) {
                const data = doc.data();
                if (data.student_id) studentIds.add(data.student_id);
            }
        });

        const profilesMap = {};
        for (const sid of Array.from(studentIds)) {
            const pSnap = await db.collection('profiles').doc(sid).get();
            if (pSnap.exists) {
                profilesMap[sid] = pSnap.data();
            }
        }

        const attCollSnap = await db.collection('courses').doc(courseId).collection('attendance').get();
        const globalAttSnap = await db.collection('attendance').where('course_id', '==', courseId).get();

        const escapeCsv = (str) => {
            if (typeof str !== 'string') return '';
            if (str.includes(';') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        let csv = "timestamp;materia;clase;estudiante_email;estudiante_nombre;estudiante_matricula;usuario_github;estado\n";

        attCollSnap.docs.forEach(doc => {
            const data = doc.data();
            const classNum = data.classNumber || doc.id.replace('class_', '');
            const records = data.records || {};
            const timestamp = data.updated_at ? (data.updated_at.toDate ? data.updated_at.toDate().toISOString() : new Date(data.updated_at).toISOString()) : new Date().toISOString();

            for (const [sid, status] of Object.entries(records)) {
                const profile = profilesMap[sid] || {};
                const email = profile.email || profile.contact_email || '';
                const name = profile.full_name || '';
                const matricula = profile.matricula_unrn || '';
                const githubUser = profile.github_username || profile.github_user || '';

                csv += `${escapeCsv(timestamp)};${escapeCsv(course.name)};${escapeCsv(String(classNum))};${escapeCsv(email)};${escapeCsv(name)};${escapeCsv(matricula)};${escapeCsv(githubUser)};${escapeCsv(String(status))}\n`;
            }
        });

        globalAttSnap.docs.forEach(doc => {
            const data = doc.data();
            const sid = data.student_id;
            const classId = data.class_id || data.classNumber || '1';
            const timestamp = data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate().toISOString() : new Date(data.timestamp).toISOString()) : new Date().toISOString();
            const profile = profilesMap[sid] || {};

            const email = profile.email || profile.contact_email || '';
            const name = profile.full_name || '';
            const matricula = profile.matricula_unrn || '';
            const githubUser = profile.github_username || profile.github_user || '';

            csv += `${escapeCsv(timestamp)};${escapeCsv(course.name)};${escapeCsv(String(classId))};${escapeCsv(email)};${escapeCsv(name)};${escapeCsv(matricula)};${escapeCsv(githubUser)};presente\n`;
        });

        res.set('Content-Type', 'text/csv; charset=utf-8');
        res.set('Content-Disposition', `attachment; filename="asistencia_${course.name.replace(/\s+/g, '_')}.csv"`);
        res.status(200).send(csv);

    } catch (e) {
        logger.error("Error exporting attendance CSV:", e);
        res.status(500).send("Error interno: " + e.message);
    }
};

exports.importGrades = async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(204).send('');
    }
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const db = getFirestore();

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
                    graded_at: FieldValue.serverTimestamp()
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
                    created_at: FieldValue.serverTimestamp()
                });
                updatedCount++;
            }
        }

        await batch.commit();
        res.status(200).send({ success: true, updatedCount });

    } catch (e) {
        logger.error(e);
        res.status(500).send("Error interno: " + e.message);
    }
};
