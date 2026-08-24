const { FieldValue } = require("firebase-admin/firestore");

/**
 * Public project portfolio. Students choose which of their own submissions
 * are publicly showcased; the public page /p/{uid} reads them server-side
 * with the Admin SDK (no Firestore rules changes needed).
 */

async function setSubmissionPortfolioVisibility(payload, context) {
    const { uid, db } = context;
    const { submissionId, isPublic } = payload;
    if (!submissionId || typeof isPublic !== 'boolean') {
        throw new Error("Faltan parámetros requeridos");
    }

    const subSnap = await db.collection('submissions').doc(submissionId).get();
    if (!subSnap.exists) throw new Error("La entrega no existe");
    if (subSnap.data().student_id !== uid) throw new Error("Solo podés gestionar la visibilidad de tus propias entregas.");

    await db.collection('submissions').doc(submissionId).update({
        is_public: isPublic,
        is_public_updated_at: FieldValue.serverTimestamp()
    });
    return { success: true, isPublic };
}

async function getMyPortfolio(payload, context) {
    const { uid, db } = context;

    const subsSnap = await db.collection('submissions')
        .where('student_id', '==', uid)
        .get();

    const items = [];
    for (const doc of subsSnap.docs) {
        const sub = doc.data();
        let assignmentTitle = null;
        let courseId = null;
        if (sub.assignment_id) {
            const aSnap = await db.collection('assignments').doc(sub.assignment_id).get();
            if (aSnap.exists) {
                assignmentTitle = aSnap.data().title;
                courseId = aSnap.data().course_id;
            }
        }
        items.push({
            id: doc.id,
            assignment_id: sub.assignment_id,
            title: assignmentTitle,
            course_id: courseId,
            repo_url: sub.repo_url || null,
            grade: sub.grade ?? null,
            is_public: Boolean(sub.is_public)
        });
    }
    return items;
}

module.exports = { setSubmissionPortfolioVisibility, getMyPortfolio };
