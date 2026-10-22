process.env.DOJO_ENCRYPTION_KEY = '22'.repeat(32);

const { memoryDb, handlerContext } = require('./helpers/memoryDb');
const { authorizeAction } = require('../src/authz');
const academic = require('../src/modules/course/academic');
const assessments = require('../src/modules/course/assessments');
const exceptions = require('../src/modules/course/exceptions');
const assignments = require('../src/modules/github/assignments');
const courses = require('../src/modules/course/courses');
const { decryptSecret, CONTEXTS } = require('../src/lib/encryption');

const denied = { code: 'permission-denied' };

function seed() {
  return memoryDb({
    'courses/c1': { name: 'Programación I', commissions: ['A', 'B'] },
    'profiles/titular': { role: 'teacher', full_name: 'Titular' },
    'profiles/ta': { role: 'teacher', full_name: 'Ayudante' },
    'profiles/s1': { role: 'student', full_name: 'Ana', matricula_unrn: 'UNRN-1001', commissions: { c1: 'A' } },
    'profiles/s2': { role: 'student', full_name: 'Beto', matricula_unrn: 'UNRN-1002', commissions: { c1: 'B' } },
    'profiles/outsider': { role: 'student', full_name: 'Otro' },
    'course_teachers/c1_titular': { course_id: 'c1', teacher_id: 'titular', role: 'titular' },
    'course_teachers/c1_ta': { course_id: 'c1', teacher_id: 'ta', role: 'ayudante' },
    'course_roster/c1_s1': { course_id: 'c1', student_id: 's1', status: 'approved' },
    'course_roster/c1_s2': { course_id: 'c1', student_id: 's2', status: 'approved' },
    'assignments/tp1': { course_id: 'c1', title: 'TP1', due_date: '2026-05-01' },
    'assignments/tp2': { course_id: 'c1', title: 'TP2', due_date: '2026-05-15' },
    'submissions/sub1': { assignment_id: 'tp1', student_id: 's1', grade: '9', status: 'submitted', submitted_at: Date.parse('2026-04-30T10:00:00-03:00') },
    'submissions/sub2': { assignment_id: 'tp2', student_id: 's1', grade: '8', status: 'submitted', submitted_at: Date.parse('2026-05-14T10:00:00-03:00') },
    'submissions/sub3': { assignment_id: 'tp1', student_id: 's2', grade: '', repo_url: 'x' },
    'courses/c1/attendance/class_1': { classNumber: 1, records: { s1: 'present', s2: 'absent' } },
    'courses/c1/attendance/class_2': { classNumber: 2, records: { s1: 'present', s2: 'absent' } },
    'courses/c1/attendance/class_3': { classNumber: 3, records: { s1: 'late', s2: 'present' } },
  });
}

const call = async (db, uid, action, handler, payload) => {
  const profile = db.docs[`profiles/${uid}`];
  const authorized = await authorizeAction(action, payload, { uid, db, profile });
  return handler(authorized, handlerContext(db, uid));
};

describe('grading rules', () => {
  test('only the titular (or an admin) can change them, and changes are audited', async () => {
    const db = seed();
    const payload = { courseId: 'c1', rules: { promotion_grade: 8 }, commissionOverrides: { B: { allow_promotion_via_recovery: true } } };
    await expect(call(db, 's1', 'updateGradingRules', academic.updateGradingRules, payload)).rejects.toMatchObject(denied);
    await expect(call(db, 'ta', 'updateGradingRules', academic.updateGradingRules, payload)).rejects.toThrow(/titular/);

    const res = await call(db, 'titular', 'updateGradingRules', academic.updateGradingRules, payload);
    expect(res.effective.promotion_grade).toBe(8);
    expect(db.docs['courses/c1'].grading_rules_by_commission.B).toEqual({ allow_promotion_via_recovery: true });
    const audit = Object.entries(db.docs).find(([p, d]) => p.startsWith('audit_logs/') && d.action === 'update_grading_rules');
    expect(audit[1]).toMatchObject({ actor_id: 'titular', new_rules: { promotion_grade: 8 } });

    const rules = await call(db, 'ta', 'getGradingRules', academic.getGradingRules, { courseId: 'c1' });
    expect(rules).toMatchObject({ canEdit: false, rules: { promotion_grade: 8 } });
  });

  test('rejects a promotion grade below the pass grade', async () => {
    const db = seed();
    await expect(call(db, 'titular', 'updateGradingRules', academic.updateGradingRules,
      { courseId: 'c1', rules: { promotion_grade: 3, partial_pass_grade: 4 } })).rejects.toThrow(/promoción/);
  });
});

describe('assessments', () => {
  test('recuperatorios must point to a partial of the same course', async () => {
    const db = seed();
    await expect(call(db, 's1', 'createAssessment', assessments.createAssessment, { courseId: 'c1', kind: 'parcial', label: 'P1' }))
      .rejects.toMatchObject(denied);
    const { id: p1 } = await call(db, 'ta', 'createAssessment', assessments.createAssessment, { courseId: 'c1', kind: 'parcial', label: 'P1' });
    await expect(call(db, 'ta', 'createAssessment', assessments.createAssessment, { courseId: 'c1', kind: 'recuperatorio', label: 'R1' }))
      .rejects.toThrow(/qué parcial/);
    const { id: r1 } = await call(db, 'ta', 'createAssessment', assessments.createAssessment, { courseId: 'c1', kind: 'recuperatorio', label: 'R1', recovers: p1 });
    await expect(call(db, 'ta', 'createAssessment', assessments.createAssessment, { courseId: 'c1', kind: 'recuperatorio', label: 'R2', recovers: r1 }))
      .rejects.toThrow(/parcial de esta cursada/);
  });

  test('grades are numeric, only for enrolled students, audited, and students see only theirs', async () => {
    const db = seed();
    const { id: p1 } = await call(db, 'titular', 'createAssessment', assessments.createAssessment, { courseId: 'c1', kind: 'parcial', label: 'P1' });

    await expect(call(db, 'titular', 'gradeAssessment', assessments.gradeAssessment, { assessmentId: p1, studentId: 's1', grade: 'Aprobado' }))
      .rejects.toThrow(/numérica/);
    await expect(call(db, 'titular', 'gradeAssessment', assessments.gradeAssessment, { assessmentId: p1, studentId: 'outsider', grade: '7' }))
      .rejects.toThrow(/no pertenece/);
    await expect(call(db, 'titular', 'gradeAssessment', assessments.gradeAssessment, { assessmentId: p1, studentId: 's1', grade: '11' }))
      .rejects.toMatchObject({ code: 'invalid-argument' });

    await call(db, 'titular', 'gradeAssessment', assessments.gradeAssessment, { assessmentId: p1, studentId: 's1', grade: '7,5' });
    expect(db.docs[`assessment_grades/${p1}_s1`]).toMatchObject({ grade: '7.5', course_id: 'c1', absent: false });

    const result = await call(db, 'titular', 'importAssessmentGrades', assessments.importAssessmentGrades, {
      assessmentId: p1,
      rows: [{ matricula: 'unrn-1002', grade: '3' }, { matricula: 'UNRN-9999', grade: '8' }, { studentId: 's1', grade: 'x' }],
    });
    expect(result.updated).toBe(1);
    expect(result.rejected.map((r) => r.row)).toEqual(['UNRN-9999', 's1']);

    const mine = await call(db, 's1', 'getAssessments', assessments.getAssessments, { courseId: 'c1' });
    expect(mine.grades.map((g) => g.student_id)).toEqual(['s1']);
    expect(mine.canGrade).toBe(false);
    const all = await call(db, 'ta', 'getAssessments', assessments.getAssessments, { courseId: 'c1' });
    expect(all.grades).toHaveLength(2);
    expect(Object.values(db.docs).filter((d) => d.action === 'grade_assessment')).toHaveLength(2);
  });
});

describe('exceptions', () => {
  test('respect max_exempt_tps, require a TP of the course, and are revoked instead of deleted', async () => {
    const db = seed();
    const grant = (payload) => call(db, 'ta', 'grantException', exceptions.grantException, { courseId: 'c1', studentId: 's2', reason: 'Certificado laboral', ...payload });

    await expect(grant({ type: 'tp_exempt' })).rejects.toThrow(/trabajo práctico/);
    await expect(grant({ type: 'deadline_extension', assignmentId: 'tp1' })).rejects.toThrow(/horas/);
    const { id } = await grant({ type: 'tp_exempt', assignmentId: 'tp1' });
    await expect(grant({ type: 'tp_exempt', assignmentId: 'tp2' })).rejects.toThrow(/hasta 1 TP/);
    await grant({ type: 'attendance_waiver' });
    await expect(grant({ type: 'attendance_waiver' })).rejects.toThrow(/ya tiene/);

    await call(db, 'titular', 'revokeException', exceptions.revokeException, { exceptionId: id, reason: 'Error de carga' });
    expect(db.docs[`course_exceptions/${id}`]).toMatchObject({ revoked: true, revoke_reason: 'Error de carga' });
    await expect(grant({ type: 'tp_exempt', assignmentId: 'tp2' })).resolves.toHaveProperty('id');

    const own = await call(db, 's1', 'getExceptions', exceptions.getExceptions, { courseId: 'c1', studentId: 's2' });
    expect(own).toEqual([]); // un alumno no ve las de otro aunque lo pida
    const staffView = await call(db, 'ta', 'getExceptions', exceptions.getExceptions, { courseId: 'c1', studentId: 's2' });
    expect(staffView).toHaveLength(3);
  });
});

describe('academic conditions', () => {
  test('computes the whole roster for staff, never for students', async () => {
    const db = seed();
    await expect(call(db, 's1', 'getAcademicConditions', academic.getAcademicConditions, { courseId: 'c1' })).rejects.toMatchObject(denied);

    const res = await call(db, 'ta', 'getAcademicConditions', academic.getAcademicConditions, { courseId: 'c1' });
    const byId = Object.fromEntries(res.results.map((r) => [r.student_id, r]));
    expect(byId.s1).toMatchObject({ condition: 'Promocionado', full_name: 'Ana', commission: 'A' });
    expect(byId.s2.condition).toBe('EN RIESGO');
    expect(byId.s2.reasons).toEqual(expect.arrayContaining(['Asistencia 33% (mínimo 75%).']));
    expect(res.summary.byCondition).toMatchObject({ Promocionado: 1, 'EN RIESGO': 1 });

    const simulated = await call(db, 'ta', 'getAcademicConditions', academic.getAcademicConditions,
      { courseId: 'c1', rulesOverride: { min_attendance: 0.3, promotion_ok_ratio: 1 } });
    expect(simulated.simulated).toBe(true);
    expect(simulated.rules.min_attendance).toBe(0.3);
  });

  test('a commission-scoped partial only applies to that commission', async () => {
    const db = seed();
    db.docs['assessments/pB'] = { course_id: 'c1', kind: 'parcial', label: 'P1 (B)', commission: 'B' };
    const res = await call(db, 'ta', 'getAcademicConditions', academic.getAcademicConditions, { courseId: 'c1' });
    const byId = Object.fromEntries(res.results.map((r) => [r.student_id, r]));
    expect(byId.s1.partials).toEqual([]);
    expect(byId.s2.partials.map((p) => p.id)).toEqual(['pB']);
  });

  test('students get only their own condition', async () => {
    const db = seed();
    const mine = await call(db, 's1', 'getMyAcademicCondition', academic.getMyAcademicCondition, { courseId: 'c1' });
    expect(mine).toMatchObject({ student_id: 's1', condition: 'Promocionado' });
    await expect(call(db, 'outsider', 'getMyAcademicCondition', academic.getMyAcademicCondition, { courseId: 'c1' }))
      .rejects.toMatchObject(denied);
    await expect(call(db, 'ta', 'getMyAcademicCondition', academic.getMyAcademicCondition, { courseId: 'c1' }))
      .rejects.toMatchObject({ code: 'failed-precondition' });
  });
});

describe('late submissions', () => {
  test('submitAssignment marks Fuera de término with tolerance and extensions', async () => {
    const db = seed();
    db.docs['assignments/tp3'] = { course_id: 'c1', title: 'TP3', due_date: '2026-03-01' };
    db.docs['submissions/sub4'] = { assignment_id: 'tp3', student_id: 's2' };
    const res = await call(db, 's2', 'submitAssignment', assignments.submitAssignment, { submissionId: 'sub4' });
    expect(res.late).toBe(true);
    expect(db.docs['submissions/sub4'].late_by_hours).toBeGreaterThan(0);

    db.docs['course_exceptions/x'] = { course_id: 'c1', student_id: 's2', type: 'deadline_extension', assignment_id: 'tp3', extra_hours: 24 * 365 * 5, revoked: false };
    expect((await call(db, 's2', 'submitAssignment', assignments.submitAssignment, { submissionId: 'sub4' })).late).toBe(false);
  });
});

describe('course GitHub token at rest', () => {
  test('is stored encrypted, never returned, and can be cleared', async () => {
    const db = seed();
    await call(db, 'titular', 'updateCourseSettings', courses.updateCourseSettings, { courseId: 'c1', data: { github_token: ' ghp_abc ' } });
    const stored = db.docs['courses/c1'].github_token;
    expect(stored).toMatch(/^enc:v1:/);
    expect(decryptSecret(stored, CONTEXTS.courseGithubToken('c1'))).toBe('ghp_abc');

    const settings = await call(db, 'titular', 'getCourseSettings', courses.getCourseSettings, { courseId: 'c1' });
    expect(settings).not.toHaveProperty('github_token');
    expect(settings.github_token_set).toBe(true);

    // Saving other fields leaves the token untouched.
    await call(db, 'titular', 'updateCourseSettings', courses.updateCourseSettings, { courseId: 'c1', data: { cover_text: 'Hola' } });
    expect(db.docs['courses/c1'].github_token).toBe(stored);

    await call(db, 'titular', 'updateCourseSettings', courses.updateCourseSettings, { courseId: 'c1', data: { github_token: null } });
    expect(db.docs['courses/c1']).not.toHaveProperty('github_token');
  });
});
