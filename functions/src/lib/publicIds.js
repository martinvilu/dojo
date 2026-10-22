/**
 * Alias públicos de estudiantes (`st_` + 10 hex aleatorios) para las URLs:
 * nunca se exponen el uid, el DNI ni el legajo (plan F5.2, decisión 1).
 *
 *   profiles/{uid}.student_public_id
 *   student_public_ids/{st_…} -> { uid }   (solo backend)
 */
const { randomBytes } = require('node:crypto');

const ALREADY_EXISTS = 6;

function generatePublicId() {
    return `st_${randomBytes(5).toString('hex')}`;
}

/** Devuelve el alias del usuario, creándolo si no tiene (reintenta ante colisión). */
async function ensureStudentPublicId(db, uid, existing) {
    if (existing) return existing;
    for (let attempt = 0; attempt < 5; attempt++) {
        const publicId = generatePublicId();
        try {
            await db.collection('student_public_ids').doc(publicId).create({ uid, created_at: new Date() });
        } catch (e) {
            if (e && (e.code === ALREADY_EXISTS || e.code === 'already-exists')) continue;
            throw e;
        }
        await db.collection('profiles').doc(uid).update({ student_public_id: publicId });
        return publicId;
    }
    throw new Error('No se pudo generar un identificador público único.');
}

module.exports = { generatePublicId, ensureStudentPublicId };
