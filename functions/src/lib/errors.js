/**
 * Errores semánticos del backend (mejora 3.33).
 *
 * Los handlers lanzan `dojoError(CODIGO, mensaje)`. El dispatcher de la
 * callable `api` lo traduce a un `HttpsError` con el estado HTTP que
 * corresponde y el código en `details.code`, para que el cliente pueda
 * reaccionar por código (`COURSE_NOT_FOUND`) en lugar de comparar textos.
 * El mensaje sigue en español y es el que se muestra al usuario.
 */
const { HttpsError } = require('firebase-functions/v2/https');

/** Código semántico -> estado de HttpsError. */
const ERROR_CODES = Object.freeze({
    // Entrada inválida
    INVALID_ARGUMENT: 'invalid-argument',
    VALIDATION_FAILED: 'invalid-argument',
    UNKNOWN_ACTION: 'invalid-argument',
    // Recursos inexistentes
    NOT_FOUND: 'not-found',
    COURSE_NOT_FOUND: 'not-found',
    ASSIGNMENT_NOT_FOUND: 'not-found',
    SUBMISSION_NOT_FOUND: 'not-found',
    PROFILE_NOT_FOUND: 'not-found',
    STUDY_GROUP_NOT_FOUND: 'not-found',
    BACKUP_NOT_FOUND: 'not-found',
    SESSION_NOT_FOUND: 'not-found',
    SCHEDULE_VERSION_NOT_FOUND: 'not-found',
    // Autenticación y permisos
    UNAUTHENTICATED: 'unauthenticated',
    AUTH_INVALID_TOKEN: 'unauthenticated',
    FORBIDDEN: 'permission-denied',
    ADMIN_ONLY: 'permission-denied',
    NOT_COURSE_MEMBER: 'permission-denied',
    ASSISTANT_NOT_ALLOWED: 'permission-denied',
    // Estado del sistema
    FAILED_PRECONDITION: 'failed-precondition',
    ASSIGNMENT_PAST_DUE: 'failed-precondition',
    ENROLLMENT_INACTIVE: 'failed-precondition',
    GITHUB_NOT_CONFIGURED: 'failed-precondition',
    MOODLE_NOT_CONFIGURED: 'failed-precondition',
    ALREADY_EXISTS: 'already-exists',
    RATE_LIMITED: 'resource-exhausted',
    UPSTREAM_ERROR: 'unavailable',
    INTERNAL: 'internal',
});

/** Estado HttpsError -> código genérico, para errores sin código propio. */
const DEFAULT_CODE_BY_STATUS = Object.freeze({
    'invalid-argument': 'INVALID_ARGUMENT',
    'not-found': 'NOT_FOUND',
    'unauthenticated': 'UNAUTHENTICATED',
    'permission-denied': 'FORBIDDEN',
    'failed-precondition': 'FAILED_PRECONDITION',
    'already-exists': 'ALREADY_EXISTS',
    'resource-exhausted': 'RATE_LIMITED',
    'unavailable': 'UPSTREAM_ERROR',
});

class DojoError extends Error {
    constructor(code, message, extra) {
        super(message);
        this.name = 'DojoError';
        this.code = Object.prototype.hasOwnProperty.call(ERROR_CODES, code) ? code : 'INTERNAL';
        this.status = ERROR_CODES[this.code];
        this.extra = extra;
    }
}

function dojoError(code, message, extra) {
    return new DojoError(code, message, extra);
}

/**
 * Convierte cualquier error lanzado por un handler en un HttpsError con
 * `details.code`. Los errores genéricos se reportan como INTERNAL.
 * @param {any} e
 * @returns {HttpsError}
 */
function toHttpsError(e) {
    if (e instanceof DojoError) {
        return new HttpsError(e.status, e.message, { code: e.code, ...(e.extra || {}) });
    }
    if (e instanceof HttpsError) {
        const details = /** @type {any} */ (e.details);
        if (details && details.code) return e;
        const code = DEFAULT_CODE_BY_STATUS[e.code] || 'INTERNAL';
        return new HttpsError(e.code, e.message, { ...(details || {}), code });
    }
    return new HttpsError('internal', (e && e.message) || 'Error interno', { code: 'INTERNAL' });
}

module.exports = { ERROR_CODES, DojoError, dojoError, toHttpsError };
