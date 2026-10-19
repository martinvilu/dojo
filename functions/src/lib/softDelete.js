/**
 * Borrado lógico de cátedras (mejora 3.21). Una cátedra eliminada conserva
 * todos sus datos durante PURGE_AFTER_DAYS: no aparece en listados ni
 * acepta operaciones de sus miembros, y un administrador puede
 * restaurarla. Pasado ese plazo, `purgeDeletedCourses` la borra en cascada.
 */
const PURGE_AFTER_DAYS = 30;

function isDeleted(data) {
    return Boolean(data && data.deleted_at);
}

async function isCourseDeleted(db, courseId) {
    const snap = await db.collection('courses').doc(String(courseId)).get();
    return Boolean(snap && snap.exists && isDeleted(snap.data()));
}

module.exports = { PURGE_AFTER_DAYS, isDeleted, isCourseDeleted };
