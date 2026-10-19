/**
 * Validación genérica del payload de la callable `api` (mejora 3.09).
 *
 * Firestore no interpreta operadores dentro de los valores, pero los IDs
 * sí tienen semántica: un `courseId` con "/" hace que `doc(courseId)`
 * apunte a otra ruta (p. ej. una subcolección) y un objeto en lugar de un
 * string rompe los handlers o las consultas. Antes de autorizar, todo
 * campo de primer nivel con forma de identificador (`id`, `*Id`, `*_id`,
 * `*Uid`) y `courseIds` se valida como ID de documento seguro, y el
 * payload completo se acota en tamaño y profundidad.
 */
const { dojoError } = require('./errors');

const ID_FIELD = /^(id|.+Id|.+_id|.+Uid)$/;
const MAX_ID_LENGTH = 256;
const MAX_PAYLOAD_BYTES = 512 * 1024;
const MAX_DEPTH = 20;
const MAX_ID_LIST = 200;

function isSafeDocId(value) {
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value !== 'string') return false;
    if (value.length === 0 || value.length > MAX_ID_LENGTH) return false;
    if (value.includes('/') || value === '.' || value === '..') return false;
    if (/^__.*__$/.test(value)) return false;
    return !/[\u0000-\u001f]/.test(value);
}

function depthOf(value, depth = 0) {
    if (depth > MAX_DEPTH) return depth;
    if (value && typeof value === 'object') {
        let max = depth;
        for (const inner of Object.values(value)) {
            max = Math.max(max, depthOf(inner, depth + 1));
            if (max > MAX_DEPTH) break;
        }
        return max;
    }
    return depth;
}

function validatePayload(payload) {
    if (payload === undefined || payload === null) return {};
    if (typeof payload !== 'object' || Array.isArray(payload)) {
        throw dojoError('INVALID_ARGUMENT', 'El payload debe ser un objeto.');
    }
    let size;
    try {
        size = Buffer.byteLength(JSON.stringify(payload));
    } catch {
        throw dojoError('INVALID_ARGUMENT', 'El payload no es serializable.');
    }
    if (size > MAX_PAYLOAD_BYTES) throw dojoError('INVALID_ARGUMENT', 'El payload es demasiado grande.');
    if (depthOf(payload) > MAX_DEPTH) throw dojoError('INVALID_ARGUMENT', 'El payload tiene demasiados niveles de anidamiento.');

    for (const [key, value] of Object.entries(payload)) {
        if (value === undefined || value === null || value === '') continue;
        if (ID_FIELD.test(key) && !isSafeDocId(value)) {
            throw dojoError('INVALID_ARGUMENT', `Identificador inválido en "${key}".`);
        }
    }
    if (payload.courseIds !== undefined) {
        const ids = payload.courseIds;
        if (!Array.isArray(ids) || ids.length > MAX_ID_LIST || !ids.every(isSafeDocId)) {
            throw dojoError('INVALID_ARGUMENT', 'Lista de cursos inválida.');
        }
    }
    return payload;
}

const EMAIL_RE = /^[^\s@"<>()\[\],;:]+@[^\s@"<>()\[\],;:]+\.[^\s@"<>()\[\],;:]+$/;

/** Email normalizado (minúsculas, sin espacios) o null si no es válido. */
function normalizeEmail(value) {
    if (typeof value !== 'string') return null;
    const email = value.trim().toLowerCase();
    return email.length <= 254 && EMAIL_RE.test(email) ? email : null;
}

module.exports = { isSafeDocId, validatePayload, normalizeEmail, MAX_PAYLOAD_BYTES };
