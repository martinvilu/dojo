import re

with open('functions/index.js', 'r') as f:
    js = f.read()

# 1. Add crypto require if not exists
if "const crypto = require('crypto');" not in js:
    js = js.replace("const admin = require(\"firebase-admin\");", "const admin = require(\"firebase-admin\");\nconst crypto = require('crypto');")

# 2. Add sync_secret generation to createAssignment
js = js.replace("if (action === 'createAssignment') {\n            await db.collection('assignments').add({", "if (action === 'createAssignment') {\n            const sync_secret = crypto.randomBytes(16).toString('hex');\n            await db.collection('assignments').add({\n                sync_secret,")

# 3. Add webhook outgoing call to acceptAssignment
webhook_logic = """
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
"""
js = js.replace("const subRef = db.collection('submissions').doc();\n            await subRef.set({", webhook_logic + "\n            const subRef = db.collection('submissions').doc();\n            await subRef.set({")

# 4. Add Webhook HTTP function at the end
webhook_http = """
exports.webhook = functions.https.onRequest(async (req, res) => {
    // Para resolver CORS
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
"""
js += "\n" + webhook_http

with open('functions/index.js', 'w') as f:
    f.write(js)
