/**
 * Códigos de asistencia rotativos tipo TOTP (mejora 3.18).
 *
 * Al iniciar la toma de asistencia el backend genera un secreto por sesión.
 * El código visible se deriva con HMAC-SHA256(secreto, intervalo) cada
 * QR_PERIOD_SECONDS: una captura del QR deja de servir en segundos y el
 * código no se puede predecir sin el secreto. `src/lib/qrToken.ts`
 * implementa la misma derivación en el navegador del docente; ambos lados
 * comparten el vector de prueba de los tests.
 */
const { createHmac, timingSafeEqual } = require('node:crypto');

const QR_PERIOD_SECONDS = 15;
// Se acepta el intervalo vigente y el anterior: un código vale como mucho
// 2 * QR_PERIOD_SECONDS, margen para escanear y para relojes desfasados.
const QR_ACCEPTED_PAST_STEPS = 1;
const QR_CODE_LENGTH = 6;
// Sin 0/O ni 1/I/L, que se confunden al tipearlos.
const QR_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function qrStepAt(epochMs, period = QR_PERIOD_SECONDS) {
    return Math.floor(epochMs / 1000 / period);
}

function qrCodeForStep(secretHex, step) {
    const digest = createHmac('sha256', Buffer.from(secretHex, 'hex')).update(String(step)).digest();
    let code = '';
    for (let i = 0; i < QR_CODE_LENGTH; i++) code += QR_ALPHABET[digest[i] % QR_ALPHABET.length];
    return code;
}

function normalizeQrCode(value) {
    return String(value ?? '').trim().toUpperCase();
}

/** true si `code` corresponde al intervalo vigente o a uno reciente. */
function isValidQrCode(secretHex, code, epochMs, period = QR_PERIOD_SECONDS) {
    const given = Buffer.from(normalizeQrCode(code));
    if (given.length !== QR_CODE_LENGTH) return false;
    const current = qrStepAt(epochMs, period);
    for (let back = 0; back <= QR_ACCEPTED_PAST_STEPS; back++) {
        const expected = Buffer.from(qrCodeForStep(secretHex, current - back));
        if (timingSafeEqual(expected, given)) return true;
    }
    return false;
}

module.exports = {
    QR_PERIOD_SECONDS,
    QR_ACCEPTED_PAST_STEPS,
    QR_CODE_LENGTH,
    QR_ALPHABET,
    qrStepAt,
    qrCodeForStep,
    normalizeQrCode,
    isValidQrCode
};
