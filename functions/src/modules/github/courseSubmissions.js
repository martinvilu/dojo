/**
 * Entregas de todo un curso en una sola llamada (mejora 3.23).
 *
 * Antes el dashboard pedía getAssignmentSubmissions por cada tarea, cada
 * una leía el perfil de cada entrega por separado, y la cola de
 * corrección se filtraba en el navegador. Ahora: consultas `in` por lotes
 * de 30 tareas (con `status == submitted` indexado cuando solo se piden las
 * pendientes), perfiles en un único `getAll` y filtro en el servidor.
 */
const { staffStudentProfile } = require('../../lib/projections');

const IN_LIMIT = 30;

function chunk(list, size) {
    const out = [];
    for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    return out;
}

const isUngraded = (s) => s.grade === undefined || s.grade === null || s.grade === '';

async function loadProfiles(db, ids) {
    if (ids.length === 0) return new Map();
    const refs = ids.map((id) => db.collection('profiles').doc(id));
    const snaps = typeof db.getAll === 'function'
        ? await db.getAll(...refs)
        : await Promise.all(refs.map((r) => r.get()));
    return new Map(snaps.map((snap, i) => [ids[i], snap.exists ? staffStudentProfile(snap.data()) : null]));
}

async function getCourseSubmissions(payload, context) {
    const { db } = context;
    const { courseId } = payload;
    const pendingOnly = payload.pendingOnly === true;

    const assignmentsSnap = await db.collection('assignments').where('course_id', '==', courseId).get();
    const titles = new Map(assignmentsSnap.docs.map((d) => [d.id, d.data().title || 'Tarea']));
    const ids = [...titles.keys()];

    const submissions = [];
    for (const group of chunk(ids, IN_LIMIT)) {
        let query = db.collection('submissions').where('assignment_id', 'in', group);
        if (pendingOnly) query = query.where('status', '==', 'submitted');
        const snap = await query.get();
        snap.docs.forEach((d) => submissions.push({ id: d.id, ...d.data() }));
    }

    const list = pendingOnly ? submissions.filter(isUngraded) : submissions;
    const profiles = await loadProfiles(db, [...new Set(list.map((s) => s.student_id).filter(Boolean))]);
    return list.map((s) => ({
        ...s,
        assignmentId: s.assignment_id,
        assignmentTitle: titles.get(s.assignment_id),
        profiles: profiles.get(s.student_id) || null
    }));
}

module.exports = { getCourseSubmissions };
