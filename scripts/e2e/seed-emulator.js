#!/usr/bin/env node
/**
 * Datos de prueba para los tests E2E (Playwright) sobre los emuladores.
 *
 * Solo corre contra emuladores de un proyecto `demo-*`: se niega a escribir
 * si falta FIRESTORE_EMULATOR_HOST o FIREBASE_AUTH_EMULATOR_HOST.
 *
 *   Cátedra "Programación I" (/b6003-programacion-1/2026/1c), comisiones 1 y 2
 *   titular@e2e.test   titular
 *   ayudante@e2e.test  ayudante de Comisión 1
 *   ana@e2e.test       estudiante de Comisión 1 (asiste y aprueba)
 *   beto@e2e.test      estudiante de Comisión 2 (falta y desaprueba)
 *   Contraseña de todos: Dojo-e2e-1234
 */
const path = require('node:path');

const functionsDir = path.resolve(__dirname, '../../functions');
const admin = require(require.resolve('firebase-admin', { paths: [functionsDir] }));

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-ninja-dojo';
const PASSWORD = 'Dojo-e2e-1234';
const COURSE_ID = 'e2e-prog1';

const USERS = [
    { uid: 'e2e-titular', email: 'titular@e2e.test', name: 'Titular E2E', role: 'teacher' },
    { uid: 'e2e-ayudante', email: 'ayudante@e2e.test', name: 'Ayudante E2E', role: 'teacher' },
    { uid: 'e2e-ana', email: 'ana@e2e.test', name: 'Ana Díaz', role: 'student', matricula: 'UNRN-10001', commission: 'Comisión 1', publicId: 'st_00000000a1' },
    { uid: 'e2e-beto', email: 'beto@e2e.test', name: 'Beto Paz', role: 'student', matricula: 'UNRN-10002', commission: 'Comisión 2', publicId: 'st_00000000b2' },
];

function assertEmulators() {
    if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
        throw new Error('seed-emulator: definí FIRESTORE_EMULATOR_HOST y FIREBASE_AUTH_EMULATOR_HOST (solo corre contra emuladores).');
    }
    if (!PROJECT_ID.startsWith('demo-')) throw new Error(`seed-emulator: el proyecto debe ser demo-*, no ${PROJECT_ID}.`);
}

async function seed() {
    assertEmulators();
    if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID });
    const db = admin.firestore();
    const auth = admin.auth();
    // Cada corrida arranca con la cursada abierta.
    await db.recursiveDelete(db.collection('course_closures').doc(COURSE_ID));

    for (const u of USERS) {
        try {
            await auth.deleteUser(u.uid);
        } catch { /* no existía */ }
        await auth.createUser({ uid: u.uid, email: u.email, password: PASSWORD, displayName: u.name, emailVerified: true });
        await db.collection('profiles').doc(u.uid).set({
            full_name: u.name,
            email: u.email,
            role: u.role,
            account_status: 'approved',
            ...(u.matricula ? { matricula_unrn: u.matricula } : {}),
            ...(u.commission ? { commissions: { [COURSE_ID]: u.commission } } : {}),
            ...(u.publicId ? { student_public_id: u.publicId } : {}),
        });
        if (u.publicId) await db.collection('student_public_ids').doc(u.publicId).set({ uid: u.uid });
    }

    const day = (n) => new Date(Date.UTC(2026, 2, 2 + n * 7, 12)).toISOString();
    await db.collection('courses').doc(COURSE_ID).set({
        name: 'Programación I',
        commissions: ['Comisión 1', 'Comisión 2'],
        start_date: '2026-03-02',
        class_instances: [1, 2, 3, 4].map((n) => ({ classNumber: n, date: day(n - 1), type: 'Teórica', topic: `Clase ${n}`, special_status: 'Normal' })),
        route_slug: 'b6003-programacion-1', route_year: 2026, route_term: '1c',
        created_at: admin.firestore.Timestamp.fromDate(new Date('2026-03-01T00:00:00Z')),
    });
    await db.collection('course_slugs').doc('b6003-programacion-1__2026__1c').set({ course_id: COURSE_ID });
    await db.collection('course_teachers').doc(`${COURSE_ID}_e2e-titular`).set({ course_id: COURSE_ID, teacher_id: 'e2e-titular', role: 'titular' });
    await db.collection('course_teachers').doc(`${COURSE_ID}_e2e-ayudante`).set({ course_id: COURSE_ID, teacher_id: 'e2e-ayudante', role: 'ayudante', commissions: ['Comisión 1'] });
    for (const s of ['e2e-ana', 'e2e-beto']) {
        await db.collection('course_roster').doc(`${COURSE_ID}_${s}`).set({ course_id: COURSE_ID, student_id: s, status: 'approved' });
        await db.collection('enrollments').doc(`${s}_${COURSE_ID}`).set({ student_id: s, course_id: COURSE_ID });
    }
    for (const n of [1, 2, 3]) {
        await db.collection('courses').doc(COURSE_ID).collection('attendance').doc(`class_${n}`).set({
            classNumber: n, records: { 'e2e-ana': 'present', 'e2e-beto': n === 1 ? 'present' : 'absent' },
        });
    }
    await db.collection('assignments').doc('e2e-tp1').set({ course_id: COURSE_ID, title: 'TP 1', template_repo: 'org/tp1', due_date: '2026-03-20', is_required: true });
    await db.collection('submissions').doc('e2e-tp1_e2e-ana').set({ assignment_id: 'e2e-tp1', student_id: 'e2e-ana', grade: '9', status: 'approved', submitted_at: '2026-03-18T10:00:00Z' });
    await db.collection('assessments').doc('e2e-p1').set({ course_id: COURSE_ID, kind: 'parcial', label: 'P1', archived: false });
    await db.collection('assessment_grades').doc('e2e-p1_e2e-ana').set({ course_id: COURSE_ID, assessment_id: 'e2e-p1', student_id: 'e2e-ana', grade: 8 });
    await db.collection('assessment_grades').doc('e2e-p1_e2e-beto').set({ course_id: COURSE_ID, assessment_id: 'e2e-p1', student_id: 'e2e-beto', grade: 2 });
}

if (require.main === module) {
    seed().then(() => console.log('seed-emulator: listo')).catch((e) => {
        console.error(e.message || e);
        process.exit(1);
    });
}

module.exports = { seed, USERS, PASSWORD, COURSE_ID, PROJECT_ID };
