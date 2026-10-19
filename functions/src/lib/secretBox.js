/**
 * Cifrado en reposo de credenciales de terceros (mejora 3.13): tokens de
 * GitHub de las cátedras. AES-256-GCM con una clave de 32 bytes en
 * TOKEN_ENCRYPTION_KEY (base64), que en producción se inyecta desde Secret
 * Manager (mejora 3.06).
 *
 * Formato: "enc:v1:<iv>:<tag>:<cifrado>" (base64url). Los valores sin el
 * prefijo se leen tal cual, para convivir con los tokens guardados antes
 * del cambio hasta que `encryptStoredSecrets` los migre. Sin clave
 * configurada no se cifra (y se avisa una vez en el log).
 */
const { createCipheriv, createDecipheriv, randomBytes } = require('node:crypto');

const PREFIX = 'enc:v1:';
let warned = false;

function loadKey(env = process.env) {
    const raw = env.TOKEN_ENCRYPTION_KEY;
    if (!raw) return null;
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY debe ser una clave de 32 bytes en base64');
    return key;
}

function isEncrypted(value) {
    return typeof value === 'string' && value.startsWith(PREFIX);
}

/** @param {string} plain @param {{ env?: any, logger?: any }} [options] */
function encryptSecret(plain, { env, logger } = {}) {
    if (typeof plain !== 'string' || plain === '' || isEncrypted(plain)) return plain;
    const key = loadKey(env);
    if (!key) {
        if (!warned && logger) {
            warned = true;
            logger.warn('[secretBox] TOKEN_ENCRYPTION_KEY no configurada: los tokens se guardan sin cifrar.');
        }
        return plain;
    }
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return PREFIX + [iv, tag, data].map((b) => b.toString('base64url')).join(':');
}

/** @param {string} value @param {{ env?: any }} [options] */
function decryptSecret(value, { env } = {}) {
    if (!isEncrypted(value)) return value;
    const key = loadKey(env);
    if (!key) throw new Error('No se puede descifrar: falta TOKEN_ENCRYPTION_KEY');
    const [iv, tag, data] = value.slice(PREFIX.length).split(':').map((p) => Buffer.from(p, 'base64url'));
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/** Token de GitHub de una cátedra, descifrado si hace falta. */
function courseGithubToken(course) {
    return course && course.github_token ? decryptSecret(course.github_token) : null;
}

module.exports = { encryptSecret, decryptSecret, isEncrypted, courseGithubToken };
