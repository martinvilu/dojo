const net = require('node:net');

const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata', 'metadata.google.internal']);
const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal'];

function isPrivateIPv4(ip) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127
        || (a === 100 && b >= 64 && b <= 127)   // CGNAT
        || (a === 169 && b === 254)             // link-local / metadata
        || (a === 172 && b >= 16 && b <= 31)
        || (a === 192 && b === 168)
        || a >= 224;                            // multicast / reservado
}

function isPrivateIPv6(ip) {
    const lower = ip.toLowerCase();
    if (lower === '::' || lower === '::1') return true;
    if (lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')) return true;
    // IPv4 mapeada: WHATWG URL la normaliza a hex (::ffff:7f00:1).
    const dotted = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (dotted) return isPrivateIPv4(dotted[1]);
    const hex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) {
        const high = parseInt(hex[1], 16);
        const low = parseInt(hex[2], 16);
        return isPrivateIPv4(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
    }
    return false;
}

/**
 * Valida URLs de servicios externos a los que el backend hará requests con
 * datos de la plataforma (outcome service de LTI, Moodle Web Services).
 * Exige HTTPS y rechaza hosts locales, privados o de metadata, para que un
 * usuario no pueda usar el backend como proxy hacia la red interna (SSRF).
 */
function isSafeExternalUrl(value) {
    if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return false;
    let url;
    try {
        url = new URL(value);
    } catch {
        return false;
    }
    if (url.protocol !== 'https:' || url.username || url.password) return false;

    const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (!hostname || BLOCKED_HOSTNAMES.has(hostname)) return false;
    if (BLOCKED_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) return false;

    const ipVersion = net.isIP(hostname);
    if (ipVersion === 4) return !isPrivateIPv4(hostname);
    if (ipVersion === 6) return !isPrivateIPv6(hostname);
    return hostname.includes('.');
}

/** Escapa texto para insertarlo en contenido o atributos XML. */
function escapeXml(value) {
    return String(value ?? '').replace(/[<>&'"]/g, (c) => ({
        '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
    })[c]);
}

module.exports = { isSafeExternalUrl, escapeXml };
