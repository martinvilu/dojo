const { memoryDb, handlerContext } = require('./helpers/memoryDb');
const { authorizeAction } = require('../src/authz');
const closure = require('../src/modules/course/closure');
const academic = require('../src/modules/course/academic');
const attendance = require('../src/modules/attendance/attendance');
const assessments = require('../src/modules/course/assessments');
const assignments = require('../src/modules/github/assignments');
const { actaRow, hashActa, toSiuCsv, canonicalJson } = require('../src/lib/academic/acta');

const HANDLERS = { ...closure, ...academic, ...attendance, ...assessments, ...assignments };

function seed() {
  const classes = Object.fromEntries([1, 2, 3, 4].map((n) => [
    `courses/c1/attendance/class_${n}`, { classNumber: n, records: { ana: 'present', beto: n === 1 ? 'present' : 'absent' } },
  ]));
  return memoryDb({
    'courses/c1': { name: 'Programación I', class_instances: [{}, {}, {}, {}] },
    'profiles/titular': { role: 'teacher', full_name: 'Titular' },
    'profiles/ta': { role: 'teacher' },
    'profiles/ana': { role: 'student', full_name: 'Ana Díaz', matricula_unrn: 'UNRN-100' },
    'profiles/beto': { role: 'student', full_name: 'Beto Paz', matricula_unrn: 'UNRN-200' },
    'course_teachers/c1_titular': { course_id: 'c1', teacher_id: 'titular', role: 'titular' },
    'course_teachers/c1_ta': { course_id: 'c1', teacher_id: 'ta', role: 'ayudante' },
    'course_roster/c1_ana': { course_id: 'c1', student_id: 'ana', status: 'approved' },
    'course_roster/c1_beto': { course_id: 'c1', student_id: 'beto', status: 'approved' },
    'assignments/a1': { course_id: 'c1', title: 'TP 1', due_date: '2026-03-01', is_required: true },
    'submissions/s1': { assignment_id: 'a1', student_id: 'ana', grade: '9', status: 'graded', submitted_at: '2026-02-20T10:00:00Z' },
    'assessments/p1': { course_id: 'c1', kind: 'parcial', label: 'P1' },
    'assessment_grades/p1_ana': { course_id: 'c1', assessment_id: 'p1', student_id: 'ana', grade: 8 },
    'assessment_grades/p1_beto': { course_id: 'c1', assessment_id: 'p1', student_id: 'beto', grade: 2 },
    ...classes,
  });
}

const call = async (db, uid, action, payload) => {
  const authorized = await authorizeAction(action, payload, { uid, db, profile: db.docs[`profiles/${uid}`] });
  return HANDLERS[action](authorized, handlerContext(db, uid));
};

describe('acta helpers', () => {
  test('hash is stable regardless of key and row order', () => {
    const rows = [{ student_id: 'b', condition: 'Regular' }, { student_id: 'a', condition: 'Promocionado' }];
    const h1 = hashActa({ courseId: 'c1', version: 1, rules: { x: 1, y: 2 }, rows });
    const h2 = hashActa({ courseId: 'c1', version: 1, rules: { y: 2, x: 1 }, rows: [...rows].reverse() });
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(h1).toBe(h2);
    expect(hashActa({ courseId: 'c1', version: 1, rules: { x: 1, y: 2 }, rows: [{ ...rows[0], condition: 'Libre' }, rows[1]] })).not.toBe(h1);
    expect(canonicalJson({ b: [1, { d: 1, c: 2 }], a: null })).toBe('{"a":null,"b":[1,{"c":2,"d":1}]}');
  });

  test('SIU CSV maps provisional conditions to Libre and guards against formulas', () => {
    const row = actaRow({ student_id: 'x', condition: 'EN RIESGO', full_name: '=HYPERLINK("x")', partials: [], reasons: [] });
    expect(row.siu_condition).toBe('Libre');
    const promoted = actaRow({ student_id: 'y', condition: 'Promocionado', full_name: 'Ana', matricula_unrn: 'UNRN-1', partials: [{ label: 'P1', best: 8 }, { label: 'P2', best: 9.5 }] });
    expect(promoted.final_grade).toBe(8.8);
    const csv = toSiuCsv({ closedAt: '2026-07-10T15:00:00Z', rows: [row, promoted] });
    const lines = csv.replace(/^﻿/, '').trim().split('\n');
    expect(lines[0]).toBe('legajo;apellido_y_nombre;comision;condicion;nota;fecha;observaciones');
    expect(lines).toContain('UNRN-1;Ana;;Promocionado;8,8;2026-07-10;');
    expect(lines.find((l) => l.includes('HYPERLINK'))).toMatch(/^;"'=HYPERLINK\(""x""\)";;Libre;;2026-07-10;Sin matrícula/);
  });
});

describe('cierre de cursada (UC-D17)', () => {
  test('only the titular closes; the acta is frozen with a verifiable hash', async () => {
    const db = seed();
    await expect(call(db, 'ta', 'closeCourse', { courseId: 'c1' })).rejects.toMatchObject({ code: 'permission-denied' });

    const res = await call(db, 'titular', 'closeCourse', { courseId: 'c1', note: 'Cierre 1C' });
    expect(res).toMatchObject({ version: 1, students: 2 });
    expect(db.docs['course_closures/c1']).toMatchObject({ status: 'closed', version: 1, hash: res.hash });

    const acta = await call(db, 'ta', 'getActa', { courseId: 'c1' });
    expect(acta.intact).toBe(true);
    const byId = Object.fromEntries(acta.rows.map((r) => [r.student_id, r]));
    expect(byId.beto.siu_condition).toBe('Libre');
    expect(byId.ana.matricula).toBe('UNRN-100');

    const exported = await call(db, 'titular', 'exportActaCsv', { courseId: 'c1' });
    expect(exported.filename).toBe(`acta_Programacion_I_v1_${res.hash.slice(0, 12)}.csv`);
    expect(exported.csv).toContain('UNRN-200;Beto Paz;;Libre;');

    // Una alteración directa en Firestore rompe la verificación y bloquea el export.
    db.docs['course_closures/c1/actas/1/parts/0'].rows[1].condition = 'Promocionado';
    expect((await call(db, 'titular', 'getCourseClosure', { courseId: 'c1' })).actas[0].intact).toBe(false);
    await expect(call(db, 'titular', 'exportActaCsv', { courseId: 'c1' })).rejects.toMatchObject({ code: 'data-loss' });
  });

  test('a closed course rejects grades, attendance, QR and rule changes until reopened', async () => {
    const db = seed();
    await call(db, 'titular', 'closeCourse', { courseId: 'c1' });
    const closed = { code: 'failed-precondition' };
    await expect(call(db, 'titular', 'gradeSubmission', { submissionId: 's1', grade: 10 })).rejects.toMatchObject(closed);
    await expect(call(db, 'titular', 'gradeAssessment', { assessmentId: 'p1', studentId: 'beto', grade: 7 })).rejects.toMatchObject(closed);
    await expect(call(db, 'titular', 'saveClassAttendance', { courseId: 'c1', classNumber: 2, records: { beto: 'present' } })).rejects.toMatchObject(closed);
    await expect(call(db, 'titular', 'startQrSession', { courseId: 'c1', classNumber: 5 })).rejects.toMatchObject(closed);
    await expect(call(db, 'titular', 'updateGradingRules', { courseId: 'c1', rules: { min_attendance: 0.5 } })).rejects.toMatchObject(closed);
    await expect(call(db, 'titular', 'closeCourse', { courseId: 'c1' })).rejects.toMatchObject(closed);

    await expect(call(db, 'titular', 'reopenCourse', { courseId: 'c1', reason: 'corto' })).rejects.toThrow();
    await expect(call(db, 'ta', 'reopenCourse', { courseId: 'c1', reason: 'Error en la nota de P1 de Beto' })).rejects.toMatchObject({ code: 'permission-denied' });
    await call(db, 'titular', 'reopenCourse', { courseId: 'c1', reason: 'Error en la nota de P1 de Beto' });
    await call(db, 'titular', 'gradeAssessment', { assessmentId: 'p1', studentId: 'beto', grade: 7 });

    const second = await call(db, 'titular', 'closeCourse', { courseId: 'c1' });
    expect(second.version).toBe(2);
    const status = await call(db, 'titular', 'getCourseClosure', { courseId: 'c1' });
    expect(status.actas.map((a) => [a.version, a.intact])).toEqual([[2, true], [1, true]]);
    expect(status.history.map((h) => h.event)).toEqual(['closed', 'reopened', 'closed']);
    expect(Object.values(db.docs).filter((d) => d.action === 'reopen_course')).toHaveLength(1);
  });

  test('students see their frozen condition after closing', async () => {
    const db = seed();
    await call(db, 'titular', 'closeCourse', { courseId: 'c1' });
    const mine = await call(db, 'beto', 'getMyAcademicCondition', { courseId: 'c1' });
    expect(mine.provisional).toBe(false);
    expect(mine.final).toMatchObject({ version: 1, siu_condition: 'Libre' });
    await expect(call(db, 'beto', 'getActa', { courseId: 'c1' })).rejects.toMatchObject({ code: 'permission-denied' });
  });
});
