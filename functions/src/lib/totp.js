/**
 * Códigos rotativos para la asistencia QR (mejora 3.18).
 *
 * HOTP (RFC 4226) sobre un contador de pasos de 15 s, como TOTP (RFC 6238),
 * pero representado con 6 caracteres de un alfabeto sin ambigüedades (sin
 * 0/O ni 1/I/L) para que el alumno pueda tipearlo desde el proyector.
 */
const { createHmac, randomBytes, timingSafeEqual } = require('node:crypto');

const STEP_SECONDS = 15;
const CODE_LENGTH = 6;
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateSecret() {
    return randomBytes(20).toString('hex');
}

function counterAt(nowMs, stepSeconds = STEP_SECONDS) {
    return Math.floor(nowMs / 1000 / stepSeconds);
}

function codeForCounter(secretHex, counter) {
    const msg = Buffer.alloc(8);
    msg.writeBigUInt64BE(BigInt(counter));
    const digest = createHmac('sha1', Buffer.from(secretHex, 'hex')).update(msg).digest();
    const offset = digest[digest.length - 1] & 0x0f;
    let value = digest.readUInt32BE(offset) & 0x7fffffff;
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
        code += ALPHABET[value % ALPHABET.length];
        value = Math.floor(value / ALPHABET.length);
    }
    return code;
}

function currentCode(secretHex, nowMs = Date.now()) {
    const counter = counterAt(nowMs);
    const nextRotationMs = (counter + 1) * STEP_SECONDS * 1000;
    return {
        code: codeForCounter(secretHex, counter),
        expiresInSeconds: Math.max(1, Math.ceil((nextRotationMs - nowMs) / 1000)),
    };
}

function normalizeCode(token) {
    return String(token || '').trim().toUpperCase().replace(/[\s-]/g, '');
}

/**
 * Acepta el código del paso actual y de los `pastSteps` anteriores (lo que
 * tarda el alumno en escanear o tipear). Nunca acepta códigos futuros.
 */
function verifyCode(secretHex, token, nowMs = Date.now(), pastSteps = 1) {
    const given = Buffer.from(normalizeCode(token));
    if (given.length !== CODE_LENGTH) return false;
    const counter = counterAt(nowMs);
    let ok = false;
    for (let c = counter - pastSteps; c <= counter; c++) {
        const expected = Buffer.from(codeForCounter(secretHex, c));
        // Sin cortocircuito: el tiempo no revela qué paso coincidió.
        if (timingSafeEqual(expected, given)) ok = true;
    }
    return ok;
}

module.exports = { generateSecret, currentCode, verifyCode, codeForCounter, counterAt, STEP_SECONDS, CODE_LENGTH, ALPHABET };
