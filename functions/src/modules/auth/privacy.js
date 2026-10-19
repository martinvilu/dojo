/**
 * Derechos sobre los datos personales (mejora 3.49, Ley 25.326 / GDPR).
 *
 * - exportMyData: arma un JSON con todo lo que la plataforma guarda del
 *   usuario (perfil, inscripciones, entregas y notas, asistencia, foros,
 *   revisiones que escribió, tutorías, grupos, XP, notificaciones y
 *   accesos). Los datos de terceros se excluyen o se reducen a IDs.
 * - requestAccountDeletion / cancelAccountDeletion: marca el pedido de
 *   baja en el perfil; un administrador lo ve en Usuarios y ejecuta la
 *   baja (deleteUser), que es irreversible.
 */
const { dojoError } = require('../../lib/errors');

const INTERNAL_PROFILE_FIELDS = ['last_auth_time'];

function plain(value) {
    if (value === null || value === undefined) return value;
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map(plain);
    if (typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
    }
    return value;
}

const docs = (snap) => snap.docs.map((d) => ({ id: d.id, ...plain(d.data()) }));

async function exportMyData(payload, context) {
    const { uid, db } = context;
    const profileRef = db.collection('profiles').doc(uid);
    const profileSnap = await profileRef.get();
    if (!profileSnap.exists) throw dojoError('PROFILE_NOT_FOUND', "Perfil no encontrado");
    const profile = plain(profileSnap.data());
    for (const field of INTERNAL_PROFILE_FIELDS) delete profile[field];

    const byField = (collection, field) => db.collection(collection).where(field, '==', uid).get().then(docs);
    const [roster, enrollments, teaching, submissions, reviewsWritten, tutoringAsStudent, tutoringAsTutor, groups, notifications, xp, security, acks] = await Promise.all([
        byField('course_roster', 'student_id'),
        byField('enrollments', 'student_id'),
        byField('course_teachers', 'teacher_id'),
        byField('submissions', 'student_id'),
        byField('peer_reviews', 'reviewer_id'),
        byField('tutoring_sessions', 'student_id'),
        byField('tutoring_sessions', 'tutor_id'),
        db.collection('study_groups').where('members', 'array-contains', uid).get().then(docs),
        byField('notifications', 'student_id'),
        profileRef.collection('xp_logs').get().then(docs),
        profileRef.collection('security_log').get().then(docs),
        byField('announcement_acknowledgments', 'student_id'),
    ]);

    // Asistencia y foros viven por curso: se recorren los cursos del usuario.
    const courseIds = [...new Set([...roster, ...enrollments, ...teaching].map((m) => m.course_id).filter(Boolean))];
    const attendance = [];
    const forumMessages = [];
    for (const courseId of courseIds) {
        const courseRef = db.collection('courses').doc(courseId);
        const [att, comments] = await Promise.all([
            courseRef.collection('attendance').get(),
            courseRef.collection('class_comments').where('user_id', '==', uid).get()
        ]);
        att.docs.forEach((d) => {
            const status = (d.data().records || {})[uid];
            if (status) attendance.push({ course_id: courseId, class: d.id, status });
        });
        forumMessages.push(...docs(comments).map((c) => ({ course_id: courseId, ...c })));
    }

    // Grupos: solo la membresía propia, sin los IDs de los demás.
    const studyGroups = groups.map(({ members, ...g }) => ({ ...g, members_count: Array.isArray(members) ? members.length : 0 }));

    return {
        generated_at: new Date().toISOString(),
        uid,
        profile,
        memberships: { course_roster: roster, enrollments, course_teachers: teaching },
        submissions,
        attendance,
        forum_messages: forumMessages,
        announcement_acknowledgments: acks,
        peer_reviews_written: reviewsWritten,
        tutoring_sessions: [...tutoringAsStudent, ...tutoringAsTutor],
        study_groups: studyGroups,
        xp_logs: xp,
        notifications,
        security_log: security,
        notes: 'Las encuestas de clase son anónimas y no se vinculan a tu cuenta, por eso no se incluyen.'
    };
}

async function requestAccountDeletion(payload, context) {
    const { uid, db } = context;
    const reason = typeof payload.reason === 'string' ? payload.reason.trim().slice(0, 1000) : '';
    await db.collection('profiles').doc(uid).update({
        deletion_requested_at: new Date(),
        deletion_reason: reason || null
    });
    return { success: true };
}

async function cancelAccountDeletion(payload, context) {
    const { uid, db, admin } = context;
    const remove = admin.firestore.FieldValue.delete();
    await db.collection('profiles').doc(uid).update({ deletion_requested_at: remove, deletion_reason: remove });
    return { success: true };
}

module.exports = { exportMyData, requestAccountDeletion, cancelAccountDeletion, plain };
