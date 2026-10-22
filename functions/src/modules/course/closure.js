/**
 * Cierre de cursada y actas (UC-D17, plan F6).
 *
 *   course_closures/{courseId}                         { status: 'closed'|'reopened', version, hash, ... }
 *   course_closures/{courseId}/actas/{v}               metadatos de la versión v (inmutable)
 *   course_closures/{courseId}/actas/{v}/parts/{n}     filas del acta, de a ROWS_PER_PART
 *
 * Cerrar congela la condición de cada alumno con las reglas vigentes y un
 * hash SHA-256 del contenido. Con la cursada cerrada, `lib/courseGuards`
 * rechaza notas, asistencia, excepciones y cambios de reglas; el titular
 * puede reabrir con una justificación y volver a cerrar (versión v+1).
 * Las actas anteriores nunca se modifican. Todo es solo backend.
 */
const { HttpsError } = require('firebase-functions/v2/https');
const { loadCourseAcademicData, computeConditions } = require('../../lib/academic/loader');
const { resolveRules, pickRules } = require('../../lib/academic/rules');
const { actaRow, hashActa, toSiuCsv } = require('../../lib/academic/acta');
const { getClosure } = require('../../lib/courseGuards');
const { assertCanEditRules } = require('./academic');

const ROWS_PER_PART = 200;

async function assertTitular(context, courseId, message) {
    const { db, uid, getMyProfile } = context;
    try {
        await assertCanEditRules(db, courseId, uid, getMyProfile ? await getMyProfile() : null);
    } catch {
        throw new HttpsError('permission-denied', message);
    }
}

function toIso(value) {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function actorName(context) {
    const p = context.getMyProfile ? await context.getMyProfile() : null;
    return (p && (p.full_name || p.email)) || context.uid;
}

const actasRef = (db, courseId) => db.collection('course_closures').doc(courseId).collection('actas');

async function loadActaRows(db, courseId, version) {
    const parts = await actasRef(db, courseId).doc(String(version)).collection('parts').get();
    return parts.docs
        .sort((a, b) => Number(a.id) - Number(b.id))
        .flatMap((d) => d.data().rows || []);
}

async function closeCourse(payload, context) {
    const { db, uid, admin } = context;
    const { courseId } = payload;
    await assertTitular(context, courseId, 'Solo el profesor titular puede cerrar la cursada.');

    const closureRef = db.collection('course_closures').doc(courseId);
    const current = await getClosure(db, courseId);
    if (current && current.status === 'closed') {
        throw new HttpsError('failed-precondition', `La cursada ya está cerrada (acta v${current.version}).`);
    }

    const data = await loadCourseAcademicData(db, courseId);
    const rows = computeConditions(data).map(actaRow);
    // Reglas efectivas: las del curso y, si las hay, las de cada comisión.
    const byCommission = data.course.grading_rules_by_commission || {};
    const rules = {
        course: resolveRules(data.course),
        commissions: Object.fromEntries(Object.keys(byCommission).map((c) => [c, pickRules(byCommission[c])])),
    };
    const version = (current ? current.version || 0 : 0) + 1;
    const hash = hashActa({ courseId, version, rules, rows });
    const summary = rows.reduce((acc, r) => ({ ...acc, [r.condition]: (acc[r.condition] || 0) + 1 }), {});
    const name = await actorName(context);
    const ts = admin.firestore.FieldValue.serverTimestamp();

    const actaRef = actasRef(db, courseId).doc(String(version));
    // Las partes primero: si algo falla a mitad, el acta no figura como cerrada.
    for (let i = 0; i * ROWS_PER_PART < rows.length || i === 0; i++) {
        await actaRef.collection('parts').doc(String(i)).set({ rows: rows.slice(i * ROWS_PER_PART, (i + 1) * ROWS_PER_PART) });
    }
    await actaRef.set({
        version, hash, rules, summary,
        students: rows.length,
        closed_by: uid, closed_by_name: name, closed_at: ts,
        justification: payload.note || '',
    });
    await closureRef.set({
        course_id: courseId,
        status: 'closed',
        version, hash, summary,
        students: rows.length,
        closed_by: uid, closed_by_name: name, closed_at: ts,
        history: admin.firestore.FieldValue.arrayUnion({ event: 'closed', version, by: uid, by_name: name, at: new Date().toISOString(), note: payload.note || '' }),
    }, { merge: true });
    await db.collection('audit_logs').add({
        action: 'close_course', course_id: courseId, actor_id: uid, actor_name: name,
        acta_version: version, acta_hash: hash, created_at: ts,
    });
    return { success: true, version, hash, students: rows.length, summary };
}

async function reopenCourse(payload, context) {
    const { db, uid, admin } = context;
    const { courseId, reason } = payload;
    await assertTitular(context, courseId, 'Solo el profesor titular puede reabrir la cursada.');
    if (!reason || reason.trim().length < 10) {
        throw new HttpsError('invalid-argument', 'Contá por qué se reabre la cursada (mínimo 10 caracteres).');
    }
    const current = await getClosure(db, courseId);
    if (!current || current.status !== 'closed') throw new HttpsError('failed-precondition', 'La cursada no está cerrada.');

    const name = await actorName(context);
    const ts = admin.firestore.FieldValue.serverTimestamp();
    await db.collection('course_closures').doc(courseId).update({
        status: 'reopened',
        reopened_by: uid, reopened_at: ts, reopen_reason: reason,
        history: admin.firestore.FieldValue.arrayUnion({ event: 'reopened', version: current.version, by: uid, by_name: name, at: new Date().toISOString(), note: reason }),
    });
    await db.collection('audit_logs').add({
        action: 'reopen_course', course_id: courseId, actor_id: uid, actor_name: name,
        acta_version: current.version, reason, created_at: ts,
    });
    return { success: true, version: current.version };
}

/** Estado del cierre y versiones del acta, con verificación de integridad de cada una. */
async function getCourseClosure(payload, context) {
    const { db } = context;
    const { courseId } = payload;
    const closure = await getClosure(db, courseId);
    if (!closure) return { status: 'open', version: 0, actas: [], history: [] };

    const actas = [];
    for (const doc of (await actasRef(db, courseId).get()).docs) {
        const meta = doc.data();
        const rows = await loadActaRows(db, courseId, meta.version);
        const intact = hashActa({ courseId, version: meta.version, rules: meta.rules, rows }) === meta.hash;
        actas.push({
            version: meta.version, hash: meta.hash, intact, students: meta.students, summary: meta.summary,
            closed_by_name: meta.closed_by_name, closed_at: toIso(meta.closed_at),
        });
    }
    actas.sort((a, b) => b.version - a.version);
    return {
        status: closure.status,
        version: closure.version,
        hash: closure.hash,
        closed_at: toIso(closure.closed_at),
        closed_by_name: closure.closed_by_name || '',
        reopen_reason: closure.reopen_reason || '',
        history: closure.history || [],
        actas,
    };
}

/** Filas de una versión del acta (la última si no se indica). */
async function getActa(payload, context) {
    const { db } = context;
    const { courseId } = payload;
    const closure = await getClosure(db, courseId);
    if (!closure) throw new HttpsError('not-found', 'La cursada todavía no tiene acta.');
    const version = Number(payload.version || closure.version);
    const metaSnap = await actasRef(db, courseId).doc(String(version)).get();
    if (!metaSnap.exists) throw new HttpsError('not-found', `No existe el acta v${version}.`);
    const meta = metaSnap.data();
    const rows = await loadActaRows(db, courseId, version);
    return {
        version, hash: meta.hash, rules: meta.rules, summary: meta.summary,
        closed_at: toIso(meta.closed_at), closed_by_name: meta.closed_by_name,
        intact: hashActa({ courseId, version, rules: meta.rules, rows }) === meta.hash,
        rows,
    };
}

/** CSV del acta para SIU Guaraní. */
async function exportActaCsv(payload, context) {
    const acta = await getActa(payload, context);
    if (!acta.intact) throw new HttpsError('data-loss', 'El acta no coincide con su hash: no se exporta. Avisá a un administrador.');
    const course = (await context.db.collection('courses').doc(payload.courseId).get()).data() || {};
    const slug = String(course.name || 'cursada').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '_');
    return {
        filename: `acta_${slug}_v${acta.version}_${acta.hash.slice(0, 12)}.csv`,
        csv: toSiuCsv({ closedAt: acta.closed_at, rows: acta.rows }),
        hash: acta.hash,
    };
}

module.exports = { closeCourse, reopenCourse, getCourseClosure, getActa, exportActaCsv, ROWS_PER_PART };
