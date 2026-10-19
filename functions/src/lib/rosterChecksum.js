/**
 * Checksums de padrones externos (mejora 3.37). Moodle y SIU Guaraní
 * devuelven el padrón completo en cada sincronización: si su SHA-256
 * coincide con el de la última vez, no hay cambios reales y se evita
 * reescribir cientos de documentos (y sus lecturas de perfiles).
 */
const { createHash } = require('node:crypto');

const norm = (v) => String(v ?? '').trim().toLowerCase();

function rosterChecksum(entries, fields) {
    const rows = (entries || [])
        .map((e) => fields.map((f) => norm(e && e[f])).join('|'))
        .sort();
    return createHash('sha256').update(rows.join('\n')).digest('hex');
}

/** Lee el checksum guardado para `source` y decide si hay que sincronizar. */
async function shouldSyncRoster(db, courseId, source, checksum, force) {
    if (force) return true;
    const snap = await db.collection('courses').doc(courseId).get();
    const previous = snap.exists ? ((snap.data().roster_sync || {})[source] || {}).checksum : null;
    return previous !== checksum;
}

async function saveRosterChecksum(db, courseId, source, checksum, count) {
    await db.collection('courses').doc(courseId).set({
        roster_sync: { [source]: { checksum, count, synced_at: new Date() } }
    }, { merge: true });
}

module.exports = { rosterChecksum, shouldSyncRoster, saveRosterChecksum };
