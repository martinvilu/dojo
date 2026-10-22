#!/usr/bin/env node
/**
 * Migración 002: URLs semánticas (plan F5).
 *   - asigna `student_public_id` (st_…) a los perfiles que no lo tienen;
 *   - da a cada cátedra sin dirección una por defecto:
 *     asignatura = nombre en slug, año y cuatrimestre según start_date.
 *     Si la combinación ya existe, agrega -2, -3…
 *
 * Idempotente. Sin --apply solo informa (dry run).
 *   GOOGLE_CLOUD_PROJECT=<proyecto> node scripts/migrations/002-semantic-routes.js [--apply]
 */
const path = require('node:path');

const functionsDir = path.resolve(__dirname, '../../functions');
const admin = require(require.resolve('firebase-admin', { paths: [functionsDir] }));
const { ensureStudentPublicId } = require(path.join(functionsDir, 'src/lib/publicIds'));
const { slugify, courseRouteKey, termFor } = require(path.join(functionsDir, 'src/lib/routes'));

const apply = process.argv.includes('--apply');

async function main() {
    admin.initializeApp();
    const db = admin.firestore();

    const profiles = await db.collection('profiles').get();
    let ids = 0;
    for (const doc of profiles.docs) {
        if (doc.data().student_public_id) continue;
        ids++;
        if (apply) await ensureStudentPublicId(db, doc.id);
    }
    console.log(`${apply ? 'Asignados' : '[dry-run] Se asignarían'} ${ids} alias st_ (de ${profiles.size} perfiles).`);

    const courses = await db.collection('courses').get();
    let routed = 0;
    for (const doc of courses.docs) {
        const c = doc.data();
        if (c.route_slug) continue;
        const start = c.start_date ? new Date(`${String(c.start_date).slice(0, 10)}T12:00:00`) : (c.created_at && c.created_at.toDate ? c.created_at.toDate() : new Date());
        const year = start.getFullYear();
        const term = termFor(start);
        const base = slugify(c.name || doc.id) || doc.id.toLowerCase();
        let slug = base;
        for (let n = 2; (await db.collection('course_slugs').doc(courseRouteKey(slug, year, term)).get()).exists; n++) slug = `${base}-${n}`;
        routed++;
        console.log(`${apply ? 'cátedra' : '[dry-run] cátedra'} ${doc.id}: /${slug}/${year}/${term}`);
        if (apply) {
            await db.collection('course_slugs').doc(courseRouteKey(slug, year, term)).set({ course_id: doc.id });
            await doc.ref.update({ route_slug: slug, route_year: year, route_term: term });
        }
    }
    console.log(`${routed} cátedras ${apply ? 'con dirección nueva' : 'recibirían dirección'}.`);
    if (!apply) console.log('Dry run: no se escribió nada. Repetí con --apply para migrar.');
}

main().catch((e) => {
    console.error(e.message || e);
    process.exit(1);
});
