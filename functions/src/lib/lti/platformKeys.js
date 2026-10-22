/**
 * JWKS de las plataformas (Moodle: `/mod/lti/certs.php`) con caché en
 * memoria. Ante un `kid` desconocido se vuelve a pedir una vez, para
 * acompañar la rotación de claves de la plataforma sin reiniciar.
 */
const { LtiError } = require('./jwt');

const CACHE_TTL_MS = 10 * 60 * 1000;
const MIN_REFETCH_MS = 30 * 1000;
const cache = new Map();

/**
 * @param {{ fetchImpl?: typeof fetch, isSafeUrl?: (url: string) => boolean, now?: () => number }} [opts]
 */
function createPlatformKeyResolver({ fetchImpl = globalThis.fetch, isSafeUrl = () => true, now = () => Date.now() } = {}) {
    async function fetchJwks(url) {
        if (!isSafeUrl(url)) throw new LtiError('invalid_platform', 'La URL del JWKS de la plataforma no es segura.');
        const res = await fetchImpl(url, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new LtiError('invalid_platform', `No se pudo leer el JWKS de la plataforma (HTTP ${res.status}).`);
        const body = await res.json();
        if (!body || !Array.isArray(body.keys)) throw new LtiError('invalid_platform', 'El JWKS de la plataforma no tiene claves.');
        const entry = { keys: body.keys, fetchedAt: now() };
        cache.set(url, entry);
        return entry;
    }

    /** Devuelve el JWK para `kid` (o la única RSA si el token no trae kid). */
    return async function resolve(jwksUrl, kid) {
        let entry = cache.get(jwksUrl);
        if (!entry || now() - entry.fetchedAt > CACHE_TTL_MS) entry = await fetchJwks(jwksUrl);
        const pick = (keys) => (kid
            ? keys.find((k) => k.kid === kid)
            : (keys.filter((k) => k.kty === 'RSA').length === 1 ? keys.find((k) => k.kty === 'RSA') : null));
        let key = pick(entry.keys);
        if (!key && now() - entry.fetchedAt > MIN_REFETCH_MS) key = pick((await fetchJwks(jwksUrl)).keys);
        return key || null;
    };
}

function clearPlatformKeyCache() {
    cache.clear();
}

module.exports = { createPlatformKeyResolver, clearPlatformKeyCache };
