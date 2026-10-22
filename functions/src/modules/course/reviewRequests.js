/**
 * Consultas de revisión sobre la ficha del estudiante (SPEC §1.3, plan F4.7):
 * el alumno abre un hilo sobre una asistencia, una entrega, una nota o un
 * parcial; la cátedra responde y lo cierra.
 *
 *   review_requests/{id} { course_id, student_id, kind, ref_id, ref_label,
 *                          status: open | answered | closed, messages[] }
 */
const { HttpsError } = require('firebase-functions/v2/https');
const { isCourseStaff } = require('../../authz');
const { toMs } = require('../../lib/academic/deadlines');

async function whoAmI(context, courseId) {
    const profile = context.getMyProfile ? await context.getMyProfile() : null;
    const staff = (profile && profile.role === 'admin') || await isCourseStaff(context.db, courseId, context.uid);
    return { staff, name: profile ? profile.full_name || profile.email || '' : '' };
}

function serialize(doc) {
    const r = doc.data();
    return {
        id: doc.id,
        student_id: r.student_id,
        student_name: r.student_name || '',
        kind: r.kind,
        ref_id: r.ref_id || null,
        ref_label: r.ref_label,
        status: r.status,
        messages: (r.messages || []).map((m) => ({ by_name: m.by_name, role: m.role, text: m.text, at: m.at })),
        updated_at: toMs(r.updated_at),
    };
}

async function createReviewRequest(payload, context) {
    const { uid, db, admin } = context;
    const { courseId, kind, refId, refLabel, message } = payload;
    const me = await whoAmI(context, courseId);
    if (me.staff) throw new HttpsError('failed-precondition', 'Las consultas de revisión las abren los estudiantes.');
    const now = new Date().toISOString();
    const ref = await db.collection('review_requests').add({
        course_id: courseId,
        student_id: uid,
        student_name: me.name,
        kind,
        ref_id: refId || null,
        ref_label: refLabel,
        status: 'open',
        messages: [{ by: uid, by_name: me.name, role: 'student', text: message.trim(), at: now }],
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { id: ref.id };
}

async function getReviewRequests(payload, context) {
    const { uid, db } = context;
    const me = await whoAmI(context, payload.courseId);
    let q = db.collection('review_requests').where('course_id', '==', payload.courseId);
    if (!me.staff) q = q.where('student_id', '==', uid);
    const snap = await q.get();
    return snap.docs.map(serialize)
        .filter((r) => !payload.status || r.status === payload.status)
        .sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));
}

async function replyReviewRequest(payload, context) {
    const { uid, db, admin } = context;
    const ref = db.collection('review_requests').doc(payload.requestId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'No se encontró la consulta.');
    const request = snap.data();
    const me = await whoAmI(context, request.course_id);
    if (!me.staff && request.student_id !== uid) throw new HttpsError('permission-denied', 'No podés responder esta consulta.');
    if (request.status === 'closed' && !me.staff) throw new HttpsError('failed-precondition', 'La consulta está cerrada.');

    const messages = [...(request.messages || [])];
    if (payload.message && payload.message.trim()) {
        messages.push({ by: uid, by_name: me.name, role: me.staff ? 'staff' : 'student', text: payload.message.trim(), at: new Date().toISOString() });
    }
    const status = payload.close ? 'closed' : (me.staff ? 'answered' : 'open');
    await ref.update({ messages, status, updated_at: admin.firestore.FieldValue.serverTimestamp() });

    if (me.staff && payload.message) {
        await db.collection('notifications').add({
            student_id: request.student_id,
            message: `💬 La cátedra respondió tu consulta sobre «${request.ref_label}».`,
            link: `/dashboard?courseId=${request.course_id}&subTab=academic`,
            read: false,
            is_daily_pending: false,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    return { success: true, status };
}

module.exports = { createReviewRequest, getReviewRequests, replyReviewRequest };
