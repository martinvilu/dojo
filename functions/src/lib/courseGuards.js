/**
 * Guardas de escritura sobre datos de estudiantes de una cursada.
 *
 * - Comisiones (plan F0.4): un ayudante con `course_teachers.commissions`
 *   solo opera sobre los alumnos de esas comisiones. Titular, admin y los
 *   ayudantes sin comisiones asignadas ven toda la cursada.
 * - Cierre (plan F6): con el acta congelada (`course_closures/{curso}`) no se
 *   cargan notas, asistencia ni excepciones hasta que el titular reabra.
 */
const { HttpsError } = require('firebase-functions/v2/https');

const NO_COMMISSION = 'Sin Comisión';

async function getProfilesById(db, ids) {
    const unique = [...new Set(ids.filter(Boolean))];
    const out = {};
    if (unique.length === 0) return out;
    if (typeof db.getAll === 'function') {
        for (let i = 0; i < unique.length; i += 100) {
            const snaps = await db.getAll(...unique.slice(i, i + 100).map((id) => db.collection('profiles').doc(id)));
            for (const s of snaps) if (s.exists) out[s.id] = s.data();
        }
        return out;
    }
    await Promise.all(unique.map(async (id) => {
        const s = await db.collection('profiles').doc(id).get();
        if (s.exists) out[id] = s.data();
    }));
    return out;
}

/**
 * Comisiones sobre las que opera `uid` en el curso: `null` = todas.
 * Solo un ayudante con lista de comisiones queda restringido.
 */
async function staffCommissionScope(db, courseId, uid) {
    const snap = await db.collection('course_teachers').doc(`${courseId}_${uid}`).get();
    if (!snap.exists) return null; // admin (authz ya validó el acceso)
    const { role, commissions } = snap.data();
    if (role !== 'ayudante' || !Array.isArray(commissions) || commissions.length === 0) return null;
    return commissions;
}

function commissionOf(profile, courseId) {
    return (profile && profile.commissions && profile.commissions[courseId]) || NO_COMMISSION;
}

/** Ids de `studentIds` fuera del alcance de `scope` (vacío si scope es null). */
async function outOfScope(db, courseId, scope, studentIds) {
    if (!scope) return [];
    const profiles = await getProfilesById(db, studentIds);
    return studentIds.filter((id) => !scope.includes(commissionOf(profiles[id], courseId)));
}

async function assertStudentsInScope(db, courseId, uid, studentIds) {
    const scope = await staffCommissionScope(db, courseId, uid);
    if ((await outOfScope(db, courseId, scope, studentIds)).length > 0) {
        throw new HttpsError('permission-denied', `Como ayudante solo podés operar sobre estudiantes de ${scope.join(', ')}.`);
    }
}

/** Filtra una lista de resultados por la comisión de cada alumno. */
async function filterToScope(db, courseId, uid, items, studentIdOf = (x) => x.student_id) {
    const scope = await staffCommissionScope(db, courseId, uid);
    if (!scope) return items;
    const excluded = new Set(await outOfScope(db, courseId, scope, items.map(studentIdOf)));
    return items.filter((x) => !excluded.has(studentIdOf(x)));
}

async function getClosure(db, courseId) {
    const snap = await db.collection('course_closures').doc(courseId).get();
    return snap.exists ? snap.data() : null;
}

async function assertCourseOpen(db, courseId) {
    const closure = await getClosure(db, courseId);
    if (closure && closure.status === 'closed') {
        throw new HttpsError('failed-precondition', 'La cursada está cerrada y el acta congelada. El titular puede reabrirla con una justificación.');
    }
}

/** Cursada abierta y estudiantes dentro del alcance del docente. */
async function assertCanEditStudents(db, courseId, uid, studentIds) {
    await assertCourseOpen(db, courseId);
    await assertStudentsInScope(db, courseId, uid, studentIds);
}

module.exports = {
    NO_COMMISSION,
    staffCommissionScope,
    commissionOf,
    outOfScope,
    assertStudentsInScope,
    filterToScope,
    getClosure,
    assertCourseOpen,
    assertCanEditStudents,
};
