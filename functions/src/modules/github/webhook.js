const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

exports.webhook = async (req, res) => {
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
    
    const db = getFirestore();
    
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
                    graded_at: FieldValue.serverTimestamp()
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
                    graded_at: FieldValue.serverTimestamp(),
                    created_at: FieldValue.serverTimestamp()
                });
                updatedCount++;
            }
        }
        await batch.commit();
        res.json({ success: true, updatedCount });
    } catch(e) {
        logger.error("Error en webhook github:", e);
        res.status(500).json({ error: e.message });
    }
};
