/**
 * Identidad institucional (SPEC §1.1, plan F0.3).
 *
 * La matrícula `UNRN-<números>` vincula notas importadas desde planillas y
 * el `lis_person_sourcedid` de Moodle, así que tiene formato estricto y no
 * puede repetirse entre perfiles.
 */
const { HttpsError } = require('firebase-functions/v2/https');

const MATRICULA_RE = /^UNRN-\d+$/;

/** Normaliza espacios y mayúsculas: " unrn-123 " → "UNRN-123". */
function normalizeMatricula(value) {
    return String(value || '').trim().toUpperCase();
}

/** Rechaza la matrícula si otro perfil ya la usa. */
async function assertMatriculaAvailable(db, uid, matricula) {
    const snap = await db.collection('profiles').where('matricula_unrn', '==', matricula).get();
    if (snap.docs.some((d) => d.id !== uid)) {
        throw new HttpsError('already-exists', 'Esa matrícula ya está registrada en otra cuenta. Si es tuya, pedile a un administrador que unifique los perfiles.');
    }
}

module.exports = { MATRICULA_RE, normalizeMatricula, assertMatriculaAvailable };
