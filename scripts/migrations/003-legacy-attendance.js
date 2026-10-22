#!/usr/bin/env node
/**
 * Migración 003: asistencia legada (plan F0.1).
 *
 * La colección raíz `attendance/{curso}_{clase}_{uid}` la escribía la acción
 * `markAttendance`, ya eliminada. La única fuente es ahora
 * `courses/{id}/attendance/class_{n}.records`. Este script copia cada registro
 * legado a esa fuente **sin pisar** un estado que ya exista (QR o carga
 * manual tienen prioridad) e informa los que no puede ubicar en una clase.
 *
 * Idempotente. Sin --apply solo informa (dry run). Con --delete-legacy borra
 * los documentos legados ya migrados.
 *   GOOGLE_CLOUD_PROJECT=<proyecto> node scripts/migrations/003-legacy-attendance.js [--apply] [--delete-legacy]
 */
const path = require('node:path');

const functionsDir = path.resolve(__dirname, '../../functions');
const admin = require(require.resolve('firebase-admin', { paths: [functionsDir] }));

const apply = process.argv.includes('--apply');
const deleteLegacy = apply && process.argv.includes('--delete-legacy');

/** `3`, `"3"`, `"class_3"` o el id de una class_instance → número de clase. */
function classNumberOf(classId, course) {
    if (Number.isInteger(classId) && classId > 0) return classId;
    const raw = String(classId || '');
    const direct = raw.match(/^(?:class_)?(\d+)$/);
    if (direct) return Number(direct[1]);
    const idx = (course.class_instances || []).findIndex((ci) => ci && ci.id === raw);
    return idx >= 0 ? idx + 1 : null;
}

async function main() {
    admin.initializeApp();
    const db = admin.firestore();
    const legacy = await db.collection('attendance').get();
    const courses = new Map();
    let migrated = 0;
    let kept = 0;
    const orphans = [];

    for (const doc of legacy.docs) {
        const { course_id: courseId, class_id: classId, student_id: studentId, status } = doc.data();
        if (!courseId || !studentId) { orphans.push(doc.id); continue; }
        if (!courses.has(courseId)) {
            const snap = await db.collection('courses').doc(courseId).get();
            courses.set(courseId, snap.exists ? snap.data() : null);
        }
        const course = courses.get(courseId);
        const classNumber = course ? classNumberOf(classId, course) : null;
        if (!classNumber) { orphans.push(doc.id); continue; }

        const ref = db.collection('courses').doc(courseId).collection('attendance').doc(`class_${classNumber}`);
        const current = await ref.get();
        if (current.exists && (current.data().records || {})[studentId]) {
            kept++;
        } else {
            migrated++;
            if (apply) {
                await ref.set({
                    classNumber,
                    records: { [studentId]: status || 'present' },
                    updated_at: admin.firestore.FieldValue.serverTimestamp(),
                    updated_by: 'migration_003',
                }, { merge: true });
            }
        }
        if (deleteLegacy) await doc.ref.delete();
    }

    console.log(`${legacy.size} registros legados: ${apply ? 'migrados' : '[dry-run] se migrarían'} ${migrated}, ${kept} ya tenían estado en la clase.`);
    if (orphans.length) console.log(`Sin clase identificable (se dejan como están): ${orphans.join(', ')}`);
    if (deleteLegacy) console.log('Legado borrado (salvo los sin clase identificable).');
    if (!apply) console.log('Dry run: no se escribió nada. Repetí con --apply para migrar.');
}

if (require.main === module) {
    main().catch((e) => {
        console.error(e.message || e);
        process.exit(1);
    });
}

module.exports = { classNumberOf };
