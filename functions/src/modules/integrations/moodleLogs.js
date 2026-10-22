/**
 * Importación idempotente de logs CSV de Moodle (SPEC §3.3, plan F4.5).
 *
 * El navegador parsea el CSV (Web Worker) y manda lotes de eventos ya
 * normalizados. Cada evento se guarda en `moodle_events/{hash}` con
 * hash = SHA-256(moodle_user_id, hora, evento, contexto): importar archivos
 * con fechas solapadas no duplica registros. Alimenta `ultima_actividad_moodle`
 * y, a través de ella, la alerta de deserción silenciosa.
 */
const { createHash } = require('node:crypto');
const { toMs } = require('../../lib/academic/deadlines');

const IN_LIMIT = 30;

function eventId(courseId, e) {
    return createHash('sha256')
        .update([courseId, e.userId, e.time, e.eventName, e.context].join('\u0000'))
        .digest('hex')
        .slice(0, 40);
}

function chunk(list, size) {
    const out = [];
    for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    return out;
}

async function importMoodleLogs(payload, context) {
    const { db, admin } = context;
    const { courseId, events } = payload;

    const refs = events.map((e) => db.collection('moodle_events').doc(eventId(courseId, e)));
    const existing = new Set();
    for (const part of chunk(refs, 100)) {
        const snaps = typeof db.getAll === 'function' ? await db.getAll(...part) : await Promise.all(part.map((r) => r.get()));
        snaps.forEach((s) => { if (s.exists) existing.add(s.id); });
    }

    let inserted = 0;
    const seen = new Set();
    const latestByUser = {};
    for (const [i, e] of events.entries()) {
        const ref = refs[i];
        if (e.timeMs && (!latestByUser[e.userId] || e.timeMs > latestByUser[e.userId])) latestByUser[e.userId] = e.timeMs;
        if (existing.has(ref.id) || seen.has(ref.id)) continue;
        seen.add(ref.id);
        await ref.set({
            course_id: courseId,
            moodle_user_id: e.userId,
            time_raw: e.time,
            time_ms: e.timeMs || null,
            event_name: e.eventName,
            context: e.context,
            component: e.component || '',
            imported_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        inserted++;
    }

    // moodle_user_id -> alumno de esta cursada.
    const roster = await db.collection('course_roster').where('course_id', '==', courseId).get();
    const rosterIds = new Set(roster.docs.map((d) => d.data().student_id));
    const userIds = [...new Set(events.map((e) => e.userId))];
    const matched = new Set();
    for (const part of chunk(userIds, IN_LIMIT)) {
        const snap = await db.collection('profiles').where('moodle_user_id', 'in', part).get();
        for (const doc of snap.docs) {
            if (!rosterIds.has(doc.id)) continue;
            const moodleId = String(doc.data().moodle_user_id);
            matched.add(moodleId);
            const latest = latestByUser[moodleId];
            if (latest && latest > (toMs(doc.data().ultima_actividad_moodle) || 0)) {
                await doc.ref.update({ ultima_actividad_moodle: new Date(latest) });
            }
        }
    }

    return {
        received: events.length,
        inserted,
        duplicates: events.length - inserted,
        matchedStudents: matched.size,
        unmatchedUserIds: userIds.filter((id) => !matched.has(id)).slice(0, 50),
    };
}

module.exports = { importMoodleLogs, eventId };
