/**
 * Solución oficial en los foros de clase (SPEC §1.3, plan F4.6).
 *
 * Antes el cliente del docente escribía `is_best_answer` directo en
 * Firestore; ahora lo hace el backend para poder otorgar los +100 XP y
 * avisarle al autor. Solo hay una solución por clase.
 */
const { HttpsError } = require('firebase-functions/v2/https');

const SOLUTION_XP = 100;

async function markCommentSolution(payload, context) {
    const { db, admin } = context;
    const { courseId, commentId, isSolution } = payload;
    const threads = db.collection('courses').doc(courseId).collection('class_comments');
    const ref = threads.doc(commentId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'No se encontró el comentario.');
    const comment = snap.data();

    if (isSolution) {
        const others = await threads.where('classNumber', '==', comment.classNumber).where('is_best_answer', '==', true).get();
        for (const other of others.docs) {
            if (other.id !== commentId) await other.ref.update({ is_best_answer: false, is_solution: false });
        }
    }
    await ref.update({ is_best_answer: Boolean(isSolution), is_solution: Boolean(isSolution) });

    if (isSolution && comment.user_id) {
        // XP idempotente: el doc lleva el id del comentario, desmarcar y volver a marcar no suma dos veces.
        const xpRef = db.collection('profiles').doc(comment.user_id).collection('xp_logs').doc(`solution_${commentId}`);
        if (!(await xpRef.get()).exists) {
            await xpRef.set({
                action: 'solucion',
                description: `Respuesta marcada como solución oficial en la Clase ${comment.classNumber}`,
                points: SOLUTION_XP,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
            await db.collection('notifications').add({
                student_id: comment.user_id,
                message: `🎖️ Tu respuesta en la Clase ${comment.classNumber} fue marcada como solución oficial (+${SOLUTION_XP} XP).`,
                link: `/dashboard?courseId=${courseId}&subTab=schedules`,
                read: false,
                is_daily_pending: false,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
    }
    return { success: true };
}

module.exports = { markCommentSolution, SOLUTION_XP };
