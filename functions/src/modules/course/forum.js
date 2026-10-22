/**
 * Solución oficial en los foros de clase (SPEC §1.3, plan F4.6).
 *
 * Antes el cliente del docente escribía `is_best_answer` directo en
 * Firestore; ahora lo hace el backend para avisarle al autor. Los +100 XP
 * los calcula `lib/xp.js` a partir de `is_solution`. Solo hay una solución por clase.
 */
const { HttpsError } = require('firebase-functions/v2/https');

const { POINTS } = require('../../lib/xp');

const SOLUTION_XP = POINTS.solution;

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

    // El XP sale de `lib/xp.js` (cuenta las soluciones vigentes); acá solo se
    // avisa una vez al autor aunque se desmarque y se vuelva a marcar.
    if (isSolution && comment.user_id && !comment.solution_notified_at) {
        await ref.update({ solution_notified_at: admin.firestore.FieldValue.serverTimestamp() });
        await db.collection('notifications').add({
            student_id: comment.user_id,
            message: `🎖️ Tu respuesta en la Clase ${comment.classNumber} fue marcada como solución oficial (+${SOLUTION_XP} XP).`,
            link: `/dashboard?courseId=${courseId}&subTab=schedules`,
            read: false,
            is_daily_pending: false,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    return { success: true };
}

module.exports = { markCommentSolution, SOLUTION_XP };
