#!/usr/bin/env node
/**
 * Migración 001: cifra en reposo las credenciales guardadas en claro
 * (mejora 3.13): `courses/*.github_token` y `gmail_credentials/*` (refresh y
 * access token).
 *
 * Idempotente: los valores que ya empiezan con `enc:v1:` se saltean.
 *
 * Uso (desde la raíz del repo):
 *   DOJO_ENCRYPTION_KEY=<64 hex> GOOGLE_CLOUD_PROJECT=<proyecto> \
 *     node scripts/migrations/001-encrypt-credentials.js [--apply]
 *
 * Sin --apply solo informa qué cambiaría (dry run). Contra el emulador:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 ... node scripts/migrations/001-encrypt-credentials.js --apply
 *
 * Usar la MISMA clave que se cargó con
 *   firebase functions:secrets:set DOJO_ENCRYPTION_KEY
 * o las funciones no podrán descifrar lo migrado.
 */
const path = require('node:path');

const functionsDir = path.resolve(__dirname, '../../functions');
const admin = require(require.resolve('firebase-admin', { paths: [functionsDir] }));
const { encryptSecret, isEncrypted, CONTEXTS } = require(path.join(functionsDir, 'src/lib/encryption'));

const apply = process.argv.includes('--apply');

async function migrateCollection(db, collection, fields) {
    const snap = await db.collection(collection).get();
    let changed = 0;
    for (const doc of snap.docs) {
        const data = doc.data();
        const update = {};
        for (const [field, context] of Object.entries(fields)) {
            const value = data[field];
            if (typeof value === 'string' && value !== '' && !isEncrypted(value)) {
                update[field] = encryptSecret(value, context(doc.id));
            }
        }
        if (Object.keys(update).length === 0) continue;
        changed++;
        console.log(`${apply ? 'cifrando' : '[dry-run] cifraría'} ${collection}/${doc.id}: ${Object.keys(update).join(', ')}`);
        if (apply) await doc.ref.update(update);
    }
    return { scanned: snap.size, changed };
}

async function main() {
    if (!process.env.DOJO_ENCRYPTION_KEY) {
        throw new Error('Definí DOJO_ENCRYPTION_KEY con la misma clave cargada en Secret Manager.');
    }
    admin.initializeApp();
    const db = admin.firestore();

    const courses = await migrateCollection(db, 'courses', { github_token: CONTEXTS.courseGithubToken });
    const gmail = await migrateCollection(db, 'gmail_credentials', {
        refresh_token: CONTEXTS.gmailRefreshToken,
        access_token: CONTEXTS.gmailAccessToken,
    });

    console.log(`courses: ${courses.changed}/${courses.scanned} · gmail_credentials: ${gmail.changed}/${gmail.scanned}`);
    if (!apply) console.log('Dry run: no se escribió nada. Repetí con --apply para migrar.');
}

main().catch((e) => {
    console.error(e.message || e);
    process.exit(1);
});
