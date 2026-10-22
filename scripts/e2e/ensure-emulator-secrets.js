#!/usr/bin/env node
/**
 * Crea functions/.secret.local con valores descartables para el emulador
 * (clave AES, clave RSA de LTI y secreto del webhook de GitHub) si no existe.
 * Nunca pisa un archivo existente ni toca Secret Manager.
 */
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, generateKeyPairSync } = require('node:crypto');

const file = path.resolve(__dirname, '../../functions/.secret.local');
if (fs.existsSync(file)) {
    console.log('functions/.secret.local ya existe: se usa tal cual.');
} else {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const lines = [
        `DOJO_ENCRYPTION_KEY=${randomBytes(32).toString('hex')}`,
        `LTI_TOOL_PRIVATE_KEY="${pem.trim().replace(/\n/g, '\\n')}"`,
        `GITHUB_WEBHOOK_SECRET=${randomBytes(24).toString('hex')}`,
    ];
    fs.writeFileSync(file, `${lines.join('\n')}\n`, { mode: 0o600 });
    console.log('functions/.secret.local creado con secretos de prueba para el emulador.');
}
