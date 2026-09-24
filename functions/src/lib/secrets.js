const { timingSafeEqual } = require('node:crypto');

/**
 * Compara un token recibido contra uno o más secretos válidos en tiempo
 * constante, para no filtrar por timing cuántos caracteres coinciden.
 * Los secretos vacíos o ausentes nunca validan.
 */
function matchesSecret(provided, ...secrets) {
    if (typeof provided !== 'string' || provided.length === 0) return false;
    const given = Buffer.from(provided);
    return secrets.some((secret) => {
        if (typeof secret !== 'string' || secret.length === 0) return false;
        const expected = Buffer.from(secret);
        return expected.length === given.length && timingSafeEqual(expected, given);
    });
}

module.exports = { matchesSecret };
