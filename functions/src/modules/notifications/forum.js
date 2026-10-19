/**
 * Aviso al autor cuando el docente marca su mensaje del foro como
 * solución (mejora 3.25). Lo dispara el trigger onClassCommentUpdated.
 * La notificación aparece en la campana del dashboard y, si el estudiante
 * eligió el resumen diario, viaja en el mail de las 20:00.
 */
async function notifyBestAnswer({ db, serverTimestamp }, courseId, before, after) {
    if (!after || !after.is_best_answer || (before && before.is_best_answer)) return false;
    if (!after.user_id) return false;

    const [profileSnap, courseSnap] = await Promise.all([
        db.collection('profiles').doc(after.user_id).get(),
        db.collection('courses').doc(courseId).get()
    ]);
    if (!profileSnap.exists) return false;
    const courseName = courseSnap.exists ? courseSnap.data().name : 'tu cátedra';

    await db.collection('notifications').add({
        student_id: after.user_id,
        type: 'best_answer',
        message: `Tu mensaje de la clase ${after.classNumber} en ${courseName} fue marcado como solución. ¡+100 XP!`,
        link: `/dashboard?courseId=${encodeURIComponent(courseId)}&subTab=schedules`,
        read: false,
        is_daily_pending: profileSnap.data().notification_pref === 'daily_summary',
        created_at: serverTimestamp()
    });
    return true;
}

module.exports = { notifyBestAnswer };
