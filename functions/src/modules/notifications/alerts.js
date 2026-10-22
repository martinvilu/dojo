/**
 * Alertas persistentes y bitácora de contacto (plan F4.2–F4.4).
 *
 *   student_alerts/{courseId}_{uid}_{type}  estado: active | contacted | snoozed | resolved
 *   contact_logs/{id}                        bitácora inmutable de intervenciones docentes
 *
 * `refreshCourseAlerts` recalcula las alertas de un curso; lo usa la acción
 * `refreshStudentAlerts` y el job diario `refreshAlertsDaily`.
 */
const { HttpsError } = require('firebase-functions/v2/https');
const { loadCourseAcademicData, computeConditions } = require('../../lib/academic/loader');
const { resolveRules } = require('../../lib/academic/rules');
const { detectAlerts, reconcileAlert, ALERT_TYPES, ALERT_LABELS } = require('../../lib/academic/alerts');
const { toMs } = require('../../lib/academic/deadlines');

const CHANNELS = ['email', 'discord', 'moodle', 'presencial', 'tutoria', 'otro'];
const alertDocId = (courseId, studentId, type) => `${courseId}_${studentId}_${type}`;

async function actorName(context) {
    const profile = context.getMyProfile ? await context.getMyProfile() : null;
    return profile ? profile.full_name || profile.email || '' : '';
}

/** Recalcula y reconcilia las alertas de todo el padrón de un curso. */
async function refreshCourseAlerts(db, courseId, admin, nowMs = Date.now()) {
    const data = await loadCourseAcademicData(db, courseId);
    const results = computeConditions(data, { nowMs });
    const existingSnap = await db.collection('student_alerts').where('course_id', '==', courseId).get();
    const existing = Object.fromEntries(existingSnap.docs.map((d) => [d.id, d.data()]));

    const summary = { students: results.length, active: 0, created: 0, resolved: 0 };
    for (const result of results) {
        const student = data.students.find((s) => s.id === result.student_id);
        const detected = detectAlerts({
            condition: result,
            rules: resolveRules(data.course, student.commission),
            assignments: data.assignments,
            submissions: data.submissionsByStudent[student.id] || {},
            lastMoodleActivityMs: student.profile ? toMs(student.profile.ultima_actividad_moodle) : null,
            nowMs,
        });
        const byType = Object.fromEntries(detected.map((a) => [a.type, a]));
        for (const type of Object.values(ALERT_TYPES)) {
            const id = alertDocId(courseId, student.id, type);
            const decision = reconcileAlert(existing[id], byType[type], nowMs);
            if (decision.op === 'none') continue;
            const ref = db.collection('student_alerts').doc(id);
            if (decision.op === 'create') {
                await ref.set({
                    course_id: courseId,
                    student_id: student.id,
                    type,
                    first_detected_at: new Date(nowMs),
                    ...decision.data,
                });
                summary.created++;
            } else {
                await ref.update(decision.data);
                if (decision.data.status === 'resolved') summary.resolved++;
            }
        }
        summary.active += detected.length;
    }
    await db.collection('courses').doc(courseId).update({ alerts_refreshed_at: admin.firestore.FieldValue.serverTimestamp() });
    return summary;
}

async function refreshStudentAlerts(payload, context) {
    return refreshCourseAlerts(context.db, payload.courseId, context.admin);
}

async function getStudentAlerts(payload, context) {
    const { db } = context;
    const { courseId, includeResolved } = payload;
    const snap = await db.collection('student_alerts').where('course_id', '==', courseId).get();
    const alerts = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .filter((a) => includeResolved || a.status !== 'resolved');

    const ids = [...new Set(alerts.map((a) => a.student_id))];
    const profiles = {};
    for (const id of ids) {
        const p = await db.collection('profiles').doc(id).get();
        if (p.exists) profiles[id] = p.data();
    }
    return alerts.map((a) => ({
        id: a.id,
        student_id: a.student_id,
        full_name: profiles[a.student_id] ? profiles[a.student_id].full_name || profiles[a.student_id].email : a.student_id,
        email: profiles[a.student_id] ? profiles[a.student_id].email || '' : '',
        commission: profiles[a.student_id] && profiles[a.student_id].commissions ? profiles[a.student_id].commissions[courseId] || null : null,
        type: a.type,
        label: ALERT_LABELS[a.type] || a.type,
        status: a.status,
        message: a.message,
        snoozed_until: a.snoozed_until || null,
        contacted_at: a.contacted_at || null,
        first_detected_at: a.first_detected_at || null,
        last_detected_at: a.last_detected_at || null,
    }));
}

async function appendContactLog(context, { courseId, studentId, channel, summary, alertId, scheduledFor }) {
    const { uid, db, admin } = context;
    const ref = await db.collection('contact_logs').add({
        course_id: courseId,
        student_id: studentId,
        actor_id: uid,
        actor_name: await actorName(context),
        channel,
        summary: summary.trim(),
        alert_id: alertId || null,
        scheduled_for: scheduledFor || null,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    return ref.id;
}

/** Cambia el estado de una alerta; "contactado" puede dejar registro en la bitácora. */
async function updateStudentAlert(payload, context) {
    const { uid, db, admin } = context;
    const ref = db.collection('student_alerts').doc(payload.alertId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'No se encontró la alerta.');
    const alert = snap.data();
    const ts = admin.firestore.FieldValue.serverTimestamp();
    const historyEntry = { action: payload.action, by: uid, at: new Date().toISOString() };

    let update;
    if (payload.action === 'contacted') {
        update = { status: 'contacted', contacted_at: ts, contacted_by: uid };
        if (payload.summary) {
            await appendContactLog(context, {
                courseId: alert.course_id, studentId: alert.student_id, channel: payload.channel || 'otro',
                summary: payload.summary, alertId: snap.id,
            });
        }
    } else if (payload.action === 'snooze') {
        const days = payload.days || 7;
        update = { status: 'snoozed', snoozed_until: new Date(Date.now() + days * 24 * 60 * 60 * 1000), snoozed_by: uid };
        historyEntry.days = days;
    } else if (payload.action === 'resolve') {
        update = { status: 'resolved', resolved_at: ts, resolved_by: uid };
    } else {
        update = { status: 'active' };
    }
    await ref.update({ ...update, history: admin.firestore.FieldValue.arrayUnion(historyEntry) });
    return { success: true, status: update.status };
}

async function addContactLog(payload, context) {
    const roster = await context.db.collection('course_roster').doc(`${payload.courseId}_${payload.studentId}`).get();
    if (!roster.exists) throw new HttpsError('invalid-argument', 'El estudiante no pertenece a esta cursada.');
    const id = await appendContactLog(context, payload);
    return { id };
}

async function getContactLogs(payload, context) {
    const { db } = context;
    let q = db.collection('contact_logs').where('course_id', '==', payload.courseId);
    if (payload.studentId) q = q.where('student_id', '==', payload.studentId);
    const snap = await q.get();
    return snap.docs
        .map((d) => {
            const c = d.data();
            return { id: d.id, student_id: c.student_id, actor_name: c.actor_name, channel: c.channel, summary: c.summary,
                alert_id: c.alert_id, scheduled_for: c.scheduled_for, created_at: toMs(c.created_at) };
        })
        .sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
}

/** "Agendar tutoría" desde una alerta: queda en la bitácora y le avisa al alumno. */
async function scheduleStudentTutoring(payload, context) {
    const { db, admin } = context;
    const { courseId, studentId, dateTime, note, alertId } = payload;
    const when = new Date(dateTime);
    if (Number.isNaN(when.getTime())) throw new HttpsError('invalid-argument', 'La fecha de la tutoría no es válida.');
    const roster = await db.collection('course_roster').doc(`${courseId}_${studentId}`).get();
    if (!roster.exists) throw new HttpsError('invalid-argument', 'El estudiante no pertenece a esta cursada.');

    const label = when.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'short', timeStyle: 'short' });
    await appendContactLog(context, {
        courseId, studentId, channel: 'tutoria', summary: note ? `Tutoría agendada: ${note}` : 'Tutoría agendada',
        alertId, scheduledFor: when.toISOString(),
    });
    await db.collection('notifications').add({
        student_id: studentId,
        message: `📅 Tu docente agendó una tutoría para el ${label}.${note ? ` ${note}` : ''}`,
        link: `/dashboard?courseId=${courseId}`,
        read: false,
        is_daily_pending: false,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    if (alertId) await updateStudentAlert({ alertId, action: 'contacted' }, context);
    return { success: true };
}

/** Job diario: recalcula las alertas de todas las cátedras activas. */
async function refreshAlertsDaily(db, admin, logger) {
    const courses = await db.collection('courses').get();
    let refreshed = 0;
    for (const course of courses.docs) {
        if (course.data().archived) continue;
        try {
            await refreshCourseAlerts(db, course.id, admin);
            refreshed++;
        } catch (e) {
            logger.error('[alerts] no se pudo recalcular', { courseId: course.id, error: e.message });
        }
    }
    return { refreshed };
}

module.exports = {
    refreshCourseAlerts,
    refreshStudentAlerts,
    getStudentAlerts,
    updateStudentAlert,
    addContactLog,
    getContactLogs,
    scheduleStudentTutoring,
    refreshAlertsDaily,
    appendContactLog,
    CHANNELS,
};
