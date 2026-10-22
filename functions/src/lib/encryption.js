/**
 * Cifrado en reposo de credenciales con AES-256-GCM (mejora 3.13).
 *
 * La clave maestra vive en Secret Manager (`DOJO_ENCRYPTION_KEY`, 32 bytes en
 * hex o base64) y se expone como variable de entorno a las funciones que la
 * declaran en `secrets`. `DOJO_ENCRYPTION_KEY_PREVIOUS` permite descifrar
 * valores escritos con la clave anterior durante una rotación.
 *
 * Formato: `enc:v1:<kid>:<iv>:<tag>:<ciphertext>` (base64url). `kid` son los
 * primeros 8 hex del SHA-256 de la clave e identifica con cuál descifrar. El
 * contexto (p. ej. `courses/abc.github_token`) se autentica como AAD, así un
 * valor cifrado no se puede copiar a otro documento o campo.
 */
const { createCipheriv, createDecipheriv, createHash, randomBytes } = require('node:crypto');

const PREFIX = 'enc:v1:';
const KEY_ENV = 'DOJO_ENCRYPTION_KEY';
const PREVIOUS_KEY_ENV = 'DOJO_ENCRYPTION_KEY_PREVIOUS';

function parseKey(raw) {
    if (!raw) return null;
    const value = String(raw).trim();
    const key = /^[0-9a-fA-F]{64}$/.test(value) ? Buffer.from(value, 'hex') : Buffer.from(value, 'base64');
    if (key.length !== 32) throw new Error(`${KEY_ENV} debe tener 32 bytes (64 hex o base64).`);
    return key;
}

function keyId(key) {
    return createHash('sha256').update(key).digest('hex').slice(0, 8);
}

function loadKeys(env = process.env) {
    const keys = [];
    for (const name of [KEY_ENV, PREVIOUS_KEY_ENV]) {
        const key = parseKey(env[name]);
        if (key) keys.push({ id: keyId(key), key });
    }
    return keys;
}

function isEncrypted(value) {
    return typeof value === 'string' && value.startsWith(PREFIX);
}

function encryptSecret(plaintext, context, env = process.env) {
    if (plaintext === null || plaintext === undefined || plaintext === '') return null;
    const [current] = loadKeys(env);
    if (!current) {
        // Fail closed: nunca guardar en claro por falta de configuración.
        throw new Error(`Falta configurar ${KEY_ENV} para guardar credenciales.`);
    }
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', current.key, iv);
    cipher.setAAD(Buffer.from(String(context)));
    const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return PREFIX + [current.id, iv, tag, ciphertext]
        .map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
        .join(':');
}

/**
 * Descifra un valor guardado con `encryptSecret`. Los valores legados en
 * claro se devuelven tal cual para no cortar el servicio antes de correr la
 * migración (`scripts/migrations/001-encrypt-credentials.js`).
 */
function decryptSecret(stored, context, env = process.env) {
    if (stored === null || stored === undefined || stored === '') return null;
    if (!isEncrypted(stored)) return String(stored);

    const [kid, ivB64, tagB64, dataB64] = stored.slice(PREFIX.length).split(':');
    const entry = loadKeys(env).find((k) => k.id === kid);
    if (!entry) throw new Error('No hay una clave de cifrado vigente para este valor (¿rotación incompleta?).');
    const decipher = createDecipheriv('aes-256-gcm', entry.key, Buffer.from(ivB64, 'base64url'));
    decipher.setAAD(Buffer.from(String(context)));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64url')), decipher.final()]).toString('utf8');
}

/** Contextos AAD de las credenciales cifradas: un único lugar para no desincronizarlos. */
const CONTEXTS = {
    courseGithubToken: (courseId) => `courses/${courseId}.github_token`,
    gmailRefreshToken: (uid) => `gmail_credentials/${uid}.refresh_token`,
    gmailAccessToken: (uid) => `gmail_credentials/${uid}.access_token`,
};

/** Token de GitHub de la cátedra, descifrado (null si no está configurado). */
function courseGithubToken(courseId, course) {
    return decryptSecret(course && course.github_token, CONTEXTS.courseGithubToken(courseId));
}

module.exports = { courseGithubToken, encryptSecret, decryptSecret, isEncrypted, loadKeys, keyId, CONTEXTS, KEY_ENV, PREVIOUS_KEY_ENV };
