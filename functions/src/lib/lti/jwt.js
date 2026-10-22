/**
 * JWT RS256 para LTI 1.3 (IMS Security Framework 1.0) con node:crypto.
 *
 * Solo RS256: es el algoritmo que exige el estándar. Cualquier otro `alg`
 * (incluido "none") se rechaza antes de mirar la firma.
 */
const { createSign, createVerify, createPublicKey, randomUUID } = require('node:crypto');

const CLOCK_SKEW_SECONDS = 60;

class LtiError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

const b64url = (input) => Buffer.from(input).toString('base64url');
const fromB64url = (input) => Buffer.from(String(input), 'base64url');

function decodeJwt(token) {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) throw new LtiError('invalid_token', 'El token no tiene formato JWT.');
    try {
        return {
            header: JSON.parse(fromB64url(parts[0]).toString('utf8')),
            payload: JSON.parse(fromB64url(parts[1]).toString('utf8')),
            signingInput: `${parts[0]}.${parts[1]}`,
            signature: fromB64url(parts[2]),
        };
    } catch {
        throw new LtiError('invalid_token', 'El token JWT no se puede decodificar.');
    }
}

/** Firma `payload` con la clave privada de la herramienta. */
function signJwt(payload, { privateKey, kid }, { expiresInSeconds = 300, nowSeconds } = {}) {
    const now = nowSeconds || Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT', kid };
    const body = { iat: now, exp: now + expiresInSeconds, jti: randomUUID(), ...payload };
    const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(body))}`;
    const signature = createSign('RSA-SHA256').update(signingInput).sign(privateKey);
    return `${signingInput}.${signature.toString('base64url')}`;
}

/**
 * Verifica firma y vigencia. `resolveKey(header)` devuelve la clave pública
 * (KeyObject, PEM o JWK) para el `kid` del encabezado.
 */
async function verifyJwt(token, resolveKey, { nowSeconds } = {}) {
    const decoded = decodeJwt(token);
    if (decoded.header.alg !== 'RS256') {
        throw new LtiError('invalid_signature', `Algoritmo de firma no permitido: ${decoded.header.alg}.`);
    }
    const key = await resolveKey(decoded.header);
    if (!key) throw new LtiError('invalid_signature', 'No hay una clave pública para verificar el token.');
    const publicKey = typeof key === 'object' && key.kty ? createPublicKey({ key, format: 'jwk' }) : key;
    const valid = createVerify('RSA-SHA256').update(decoded.signingInput).verify(publicKey, decoded.signature);
    if (!valid) throw new LtiError('invalid_signature', 'La firma del token no es válida.');

    const now = nowSeconds || Math.floor(Date.now() / 1000);
    const { exp, iat, nbf } = decoded.payload;
    if (typeof exp !== 'number' || exp + CLOCK_SKEW_SECONDS < now) throw new LtiError('expired', 'El token venció.');
    if (typeof iat === 'number' && iat - CLOCK_SKEW_SECONDS > now) throw new LtiError('invalid_token', 'El token fue emitido en el futuro.');
    if (typeof nbf === 'number' && nbf - CLOCK_SKEW_SECONDS > now) throw new LtiError('invalid_token', 'El token todavía no es válido.');
    return decoded;
}

module.exports = { signJwt, verifyJwt, decodeJwt, LtiError, CLOCK_SKEW_SECONDS };
