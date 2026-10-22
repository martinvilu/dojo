/**
 * Errores inesperados del backend a Sentry (plan F8 / mejora 5.07).
 *
 * Solo con SENTRY_DSN en el entorno de Functions; sin DSN, `reportError` no
 * hace nada. Los HttpsError de validación, permisos o límites son respuestas
 * esperadas y no se reportan. Nunca se envían payloads ni datos de usuario:
 * solo la acción y el uid (opaco).
 */
const EXPECTED_CODES = new Set([
    'invalid-argument', 'permission-denied', 'unauthenticated', 'not-found',
    'already-exists', 'failed-precondition', 'resource-exhausted', 'out-of-range',
]);

let sentry = null;

function init(env = process.env) {
    if (sentry || !env.SENTRY_DSN) return sentry;
    sentry = require('@sentry/node');
    sentry.init({
        dsn: env.SENTRY_DSN,
        environment: env.SENTRY_ENVIRONMENT || 'production',
        tracesSampleRate: 0,
        dataCollection: {
            userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false, databaseQueryData: false,
        },
    });
    return sentry;
}

function isExpected(error) {
    return Boolean(error && error.httpErrorCode && EXPECTED_CODES.has(error.code));
}

/**
 * Reporta `error` si es inesperado. Devuelve true si se envió.
 * @param {any} error
 * @param {{ action?: string, uid?: string }} [meta]
 * @param {any} [client]
 */
function reportError(error, { action, uid } = {}, client = sentry) {
    if (!client || isExpected(error)) return false;
    client.withScope((scope) => {
        if (action) scope.setTag('action', action);
        if (uid) scope.setUser({ id: uid });
        client.captureException(error);
    });
    return true;
}

module.exports = { init, reportError, isExpected, EXPECTED_CODES };
