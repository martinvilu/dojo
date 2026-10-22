/**
 * Comisiones de primera clase (plan F0.4).
 *
 *   profiles/{uid}.commissions[courseId]           comisión del alumno
 *   course_teachers/{courseId}_{uid}.commissions[]  comisiones del ayudante
 *
 * Antes cualquier docente podía reescribir `profiles.commissions` desde el
 * cliente; con ayudantes restringidos por comisión, eso le permitiría a un
 * ayudante "mover" alumnos a la suya. Ahora asignan comisiones solo quienes
 * ven toda la cursada (titular, admin o ayudante sin restricción).
 */
const { HttpsError } = require('firebase-functions/v2/https');
const { staffCommissionScope, NO_COMMISSION } = require('../../lib/courseGuards');
const { assertCanEditRules } = require('./academic');

async function courseCommissions(db, courseId) {
    const snap = await db.collection('courses').doc(courseId).get();
    if (!snap.exists) throw new HttpsError('not-found', 'Curso no encontrado.');
    return snap.data().commissions || [];
}

async function setStudentCommission(payload, context) {
    const { db, uid, admin } = context;
    const { courseId, studentId } = payload;
    const commission = payload.commission === NO_COMMISSION ? '' : (payload.commission || '');
    if (await staffCommissionScope(db, courseId, uid)) {
        throw new HttpsError('permission-denied', 'Solo el titular puede cambiar a un estudiante de comisión.');
    }
    if (commission && !(await courseCommissions(db, courseId)).includes(commission)) {
        throw new HttpsError('invalid-argument', 'Esa comisión no existe en la cursada.');
    }
    const roster = await db.collection('course_roster').doc(`${courseId}_${studentId}`).get();
    if (!roster.exists) throw new HttpsError('invalid-argument', 'El estudiante no pertenece a esta cursada.');

    await db.collection('profiles').doc(studentId).update({ [`commissions.${courseId}`]: commission });
    await db.collection('audit_logs').add({
        action: 'set_student_commission',
        course_id: courseId,
        student_id: studentId,
        actor_id: uid,
        new_value: commission || NO_COMMISSION,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true, commission };
}

async function setTeacherCommissions(payload, context) {
    const { db, uid, getMyProfile } = context;
    const { courseId, teacherId } = payload;
    await assertCanEditRules(db, courseId, uid, getMyProfile ? await getMyProfile() : null).catch(() => {
        throw new HttpsError('permission-denied', 'Solo el titular asigna comisiones a los ayudantes.');
    });
    const ref = db.collection('course_teachers').doc(`${courseId}_${teacherId}`);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Ese docente no está asignado a la cursada.');
    if (snap.data().role !== 'ayudante') {
        throw new HttpsError('failed-precondition', 'Solo los ayudantes se restringen por comisión.');
    }
    const valid = await courseCommissions(db, courseId);
    const commissions = [...new Set(payload.commissions || [])];
    const unknown = commissions.filter((c) => !valid.includes(c) && c !== NO_COMMISSION);
    if (unknown.length) throw new HttpsError('invalid-argument', `Comisiones inexistentes: ${unknown.join(', ')}.`);
    await ref.update({ commissions });
    return { success: true, commissions };
}

module.exports = { setStudentCommission, setTeacherCommissions };
