/**
 * Excepciones de cursada justificadas por la cátedra (plan F2.3).
 *
 *   course_exceptions/{id} { course_id, student_id, type, assignment_id,
 *                            extra_hours, reason, granted_by, revoked, ... }
 *
 * Tipos: attendance_waiver (eximición del porcentaje de asistencia),
 * tp_exempt (exceptuar un TP obligatorio), deadline_extension (prórroga en
 * horas corridas para un TP). Nunca se borran: se revocan, y cada cambio
 * deja una entrada en audit_logs.
 */
const { HttpsError } = require('firebase-functions/v2/https');
const { resolveRules } = require('../../lib/academic/rules');
const { isCourseStaff } = require('../../authz');
const { assertCanEditStudents } = require('../../lib/courseGuards');

async function actorName(context) {
    const profile = context.getMyProfile ? await context.getMyProfile() : null;
    return profile ? profile.full_name || profile.email || '' : '';
}

function serialize(doc) {
    const e = doc.data();
    return {
        id: doc.id,
        student_id: e.student_id,
        type: e.type,
        assignment_id: e.assignment_id || null,
        extra_hours: e.extra_hours || null,
        reason: e.reason,
        granted_by_name: e.granted_by_name || '',
        granted_at: e.granted_at || null,
        revoked: Boolean(e.revoked),
        revoke_reason: e.revoke_reason || '',
    };
}

async function getExceptions(payload, context) {
    const { uid, db, getMyProfile } = context;
    const { courseId, studentId } = payload;
    const profile = getMyProfile ? await getMyProfile() : null;
    const staff = (profile && profile.role === 'admin') || await isCourseStaff(db, courseId, uid);

    let q = db.collection('course_exceptions').where('course_id', '==', courseId);
    // Un estudiante solo ve las propias, pida lo que pida.
    const target = staff ? studentId : uid;
    if (target) q = q.where('student_id', '==', target);
    const snap = await q.get();
    return snap.docs.map(serialize);
}

async function grantException(payload, context) {
    const { uid, db, admin } = context;
    const { courseId, studentId, type, assignmentId, extraHours, reason } = payload;

    const roster = await db.collection('course_roster').doc(`${courseId}_${studentId}`).get();
    if (!roster.exists || roster.data().status === 'removed') {
        throw new HttpsError('invalid-argument', 'El estudiante no pertenece a esta cursada.');
    }
    await assertCanEditStudents(db, courseId, uid, [studentId]);

    if (type === 'tp_exempt' || type === 'deadline_extension') {
        if (!assignmentId) throw new HttpsError('invalid-argument', 'Indicá el trabajo práctico.');
        const a = await db.collection('assignments').doc(assignmentId).get();
        if (!a.exists || a.data().course_id !== courseId) {
            throw new HttpsError('invalid-argument', 'El trabajo práctico no pertenece a esta cursada.');
        }
    }
    if (type === 'deadline_extension' && !extraHours) {
        throw new HttpsError('invalid-argument', 'Indicá cuántas horas de prórroga se otorgan.');
    }

    const existingSnap = await db.collection('course_exceptions')
        .where('course_id', '==', courseId).where('student_id', '==', studentId).get();
    const active = existingSnap.docs.map((d) => d.data()).filter((e) => !e.revoked);

    if (type === 'attendance_waiver' && active.some((e) => e.type === 'attendance_waiver')) {
        throw new HttpsError('already-exists', 'El estudiante ya tiene eximida la asistencia.');
    }
    if (type === 'tp_exempt') {
        if (active.some((e) => e.type === 'tp_exempt' && e.assignment_id === assignmentId)) {
            throw new HttpsError('already-exists', 'Ese TP ya está exceptuado para el estudiante.');
        }
        const course = (await db.collection('courses').doc(courseId).get()).data() || {};
        const profile = (await db.collection('profiles').doc(studentId).get()).data() || {};
        const rules = resolveRules(course, profile.commissions && profile.commissions[courseId]);
        const used = active.filter((e) => e.type === 'tp_exempt').length;
        if (used >= rules.max_exempt_tps) {
            throw new HttpsError('failed-precondition', `Las reglas permiten exceptuar hasta ${rules.max_exempt_tps} TP por estudiante.`);
        }
    }

    const name = await actorName(context);
    const ref = await db.collection('course_exceptions').add({
        course_id: courseId,
        student_id: studentId,
        type,
        assignment_id: assignmentId || null,
        extra_hours: type === 'deadline_extension' ? extraHours : null,
        reason: reason.trim(),
        granted_by: uid,
        granted_by_name: name,
        granted_at: admin.firestore.FieldValue.serverTimestamp(),
        revoked: false,
    });
    await db.collection('audit_logs').add({
        action: 'grant_exception',
        course_id: courseId,
        student_id: studentId,
        exception_id: ref.id,
        exception_type: type,
        assignment_id: assignmentId || '',
        reason: reason.trim(),
        actor_id: uid,
        actor_name: name,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { id: ref.id };
}

async function revokeException(payload, context) {
    const { uid, db, admin } = context;
    const ref = db.collection('course_exceptions').doc(payload.exceptionId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'No se encontró la excepción.');
    const exception = snap.data();
    if (exception.revoked) return { success: true };
    await assertCanEditStudents(db, exception.course_id, uid, [exception.student_id]);

    const name = await actorName(context);
    await ref.update({
        revoked: true,
        revoked_by: uid,
        revoked_at: admin.firestore.FieldValue.serverTimestamp(),
        revoke_reason: payload.reason || '',
    });
    await db.collection('audit_logs').add({
        action: 'revoke_exception',
        course_id: exception.course_id,
        student_id: exception.student_id,
        exception_id: snap.id,
        exception_type: exception.type,
        reason: payload.reason || '',
        actor_id: uid,
        actor_name: name,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true };
}

module.exports = { getExceptions, grantException, revokeException };
