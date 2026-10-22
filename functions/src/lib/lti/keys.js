/**
 * Claves RSA de la herramienta (Dojo) para LTI 1.3.
 *
 * `LTI_TOOL_PRIVATE_KEY` (PEM PKCS#8) firma los mensajes de la herramienta:
 * respuestas de Deep Linking y aserciones client_credentials para NRPS/AGS.
 * `LTI_TOOL_PRIVATE_KEY_PREVIOUS` sigue publicada en el JWKS durante una
 * rotación, para que la plataforma acepte tokens recién firmados con la
 * anterior. Ambas vienen de Secret Manager.
 */
const { createHash, createPrivateKey, createPublicKey } = require('node:crypto');
const { LtiError } = require('./jwt');

const KEY_ENV = 'LTI_TOOL_PRIVATE_KEY';
const PREVIOUS_KEY_ENV = 'LTI_TOOL_PRIVATE_KEY_PREVIOUS';

/** Los secretos de una línea llegan con "\n" literales. */
function normalizePem(raw) {
    return String(raw).trim().replace(/\\n/g, '\n');
}

/** RFC 7638: huella del JWK público, estable entre despliegues. */
function thumbprint(jwk) {
    const canonical = JSON.stringify({ e: jwk.e, kty: jwk.kty, n: jwk.n });
    return createHash('sha256').update(canonical).digest('base64url');
}

function loadKey(raw) {
    const privateKey = createPrivateKey(normalizePem(raw));
    const jwk = createPublicKey(privateKey).export({ format: 'jwk' });
    if (jwk.kty !== 'RSA') throw new Error(`${KEY_ENV} debe ser una clave RSA.`);
    const kid = thumbprint(jwk);
    return { privateKey, kid, publicJwk: { ...jwk, kid, alg: 'RS256', use: 'sig' } };
}

function loadToolKeys(env = process.env) {
    return [env[KEY_ENV], env[PREVIOUS_KEY_ENV]].filter(Boolean).map(loadKey);
}

/** Clave vigente para firmar; falla explícitamente si no está configurada. */
function currentSigningKey(env = process.env) {
    const [current] = loadToolKeys(env);
    if (!current) throw new LtiError('not_configured', `Falta configurar ${KEY_ENV} (clave RSA de la herramienta LTI).`);
    return current;
}

/** JWKS público de la herramienta (`/api/v1/lti/jwks`). */
function toolJwks(env = process.env) {
    return { keys: loadToolKeys(env).map((k) => k.publicJwk) };
}

module.exports = { loadToolKeys, currentSigningKey, toolJwks, thumbprint, KEY_ENV, PREVIOUS_KEY_ENV };
