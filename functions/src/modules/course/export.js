const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

// Los exports CSV (notas / asistencia / roster) fueron unificados en el
// App Router: GET /api/export/csv (ver src/app/api/export/csv/route.ts).
// Este módulo conserva únicamente la importación de notas.

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
