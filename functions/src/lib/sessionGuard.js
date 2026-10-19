/**
 * Revocación de sesiones (mejora 3.29).
 *
 * Firebase revoca los refresh tokens al cambiar o resetear la contraseña,
 * y `signOutEverywhere` los revoca a pedido, pero un ID token ya emitido
 * sigue siendo válido hasta una hora y `onCall` no lo comprueba. Este guard
 * rechaza los tokens cuyo `auth_time` es anterior a `tokensValidAfterTime`
 * del usuario. El dato se cachea 60 s por instancia para no consultar Auth
 * en cada llamada; si Auth no responde, la llamada pasa (fail-open).
 */
const { HttpsError } = require('firebase-functions/v2/https');

const CACHE_MS = 60 * 1000;
const cache = new Map();

async function validAfterSeconds(auth, uid, now) {
    const hit = cache.get(uid);
    if (hit && now - hit.fetchedAt < CACHE_MS) return hit.validAfter;
    const user = await auth.getUser(uid);
    const validAfter = user.tokensValidAfterTime ? Math.floor(new Date(user.tokensValidAfterTime).getTime() / 1000) : 0;
    cache.set(uid, { validAfter, fetchedAt: now });
    return validAfter;
}

async function assertSessionNotRevoked(auth, token, { logger, now = Date.now() } = {}) {
    if (!token || !token.uid || !token.auth_time) return;
    let validAfter;
    try {
        validAfter = await validAfterSeconds(auth, token.uid, now);
    } catch (e) {
        if (logger) logger.warn('[sessionGuard] no se pudo consultar Auth:', e.message);
        return;
    }
    if (Number(token.auth_time) < validAfter) {
        throw new HttpsError('unauthenticated', 'Tu sesión fue cerrada. Volvé a iniciar sesión.', { code: 'AUTH_SESSION_REVOKED' });
    }
}

function forgetSession(uid) {
    cache.delete(uid);
}

module.exports = { assertSessionNotRevoked, forgetSession, CACHE_MS };
