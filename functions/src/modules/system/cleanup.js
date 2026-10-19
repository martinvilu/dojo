/**
 * Limpieza de datos derivados (mejoras 3.21 y 3.47).
 *
 * - `purgeDeletedCourses` (cron diario): borra en cascada las cátedras cuyo
 *   borrado lógico venció (`purge_after`): membresías, tareas (cuyas
 *   entregas limpia el trigger de abajo) y subcolecciones del curso.
 * - `cleanupAssignmentData` (trigger onDocumentDeleted de `assignments`):
 *   borra entregas y revisiones entre pares de la tarea eliminada, que de
 *   otro modo quedaban huérfanas. La auditoría de notas se conserva.
 */
const BATCH_SIZE = 400;

async function deleteQueryInBatches(db, query) {
    let deleted = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const snap = await query.limit(BATCH_SIZE).get();
        if (snap.empty) return deleted;
        const batch = db.batch();
        snap.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        deleted += snap.size;
        if (snap.size < BATCH_SIZE) return deleted;
    }
}

async function cleanupAssignmentData(db, assignmentId) {
    const submissions = await deleteQueryInBatches(db, db.collection('submissions').where('assignment_id', '==', assignmentId));
    const reviews = await deleteQueryInBatches(db, db.collection('peer_reviews').where('assignment_id', '==', assignmentId));
    return { submissions, reviews };
}

async function purgeCourse(db, courseId) {
    const byCourse = (name) => db.collection(name).where('course_id', '==', courseId);
    const counts = {};
    for (const name of ['course_teachers', 'course_roster', 'enrollments', 'assignments', 'announcements', 'study_groups', 'schedule_versions', 'scheduled_emails']) {
        counts[name] = await deleteQueryInBatches(db, byCourse(name));
    }
    const courseRef = db.collection('courses').doc(courseId);
    if (typeof db.recursiveDelete === 'function') {
        // Incluye subcolecciones: attendance, active_qr, class_comments, class_feedback.
        await db.recursiveDelete(courseRef);
    } else {
        await courseRef.delete();
    }
    return counts;
}

async function purgeDeletedCourses(db, logger, now = new Date()) {
    const snap = await db.collection('courses').where('purge_after', '<=', now).get();
    const purged = [];
    for (const doc of snap.docs) {
        if (!doc.data().deleted_at) continue;
        const counts = await purgeCourse(db, doc.id);
        purged.push(doc.id);
        if (logger) logger.info(`[cleanup] Cátedra ${doc.id} purgada`, counts);
    }
    return purged;
}

/** Borra los archivos de exportación de más de 7 días (mejora 3.16). */
async function purgeExpiredExports(bucket, now = Date.now()) {
    const [files] = await bucket.getFiles({ prefix: 'exports/' });
    const expired = files.filter((f) => now - new Date(f.metadata.timeCreated).getTime() > 7 * 24 * 60 * 60 * 1000);
    await Promise.all(expired.map((f) => f.delete({ ignoreNotFound: true })));
    return expired.length;
}

module.exports = { cleanupAssignmentData, purgeCourse, purgeDeletedCourses, deleteQueryInBatches, purgeExpiredExports };
