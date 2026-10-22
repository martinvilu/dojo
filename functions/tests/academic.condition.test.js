const { computeAcademicCondition, CONDITIONS } = require('../src/lib/academic/condition');
const { resolveRules, DEFAULT_RULES } = require('../src/lib/academic/rules');
const { dueAtMs, lateness, isPastDeadline } = require('../src/lib/academic/deadlines');

const NOW = Date.parse('2026-06-30T12:00:00-03:00');
const S = 'st1';

// 4 clases tomadas; `present` = cuántas asistió el alumno.
const classes = (present, total = 4, extra = {}) => Array.from({ length: total }, (_, i) => ({
  classNumber: i + 1,
  records: { [S]: i < present ? 'present' : 'absent', other: 'present', ...(extra[i + 1] ? { [S]: extra[i + 1] } : {}) },
}));

const tp = (id, due = '2026-05-01', extra = {}) => ({ id, title: id.toUpperCase(), due_date: due, ...extra });
const ok = (grade = '8', extra = {}) => ({ status: 'submitted', submitted_at: Date.parse('2026-04-30T10:00:00-03:00'), grade, ...extra });
const parcial = (id, label) => ({ id, kind: 'parcial', label });
const recup = (id, label, recovers) => ({ id, kind: 'recuperatorio', label, recovers });

function run(overrides = {}) {
  return computeAcademicCondition({
    studentId: S,
    course: {},
    attendance: classes(4),
    assignments: [tp('tp1'), tp('tp2')],
    submissions: { tp1: ok(), tp2: ok() },
    assessments: [parcial('p1', 'P1'), parcial('p2', 'P2')],
    assessmentGrades: { p1: { grade: '8' }, p2: { grade: '9' } },
    exceptions: [],
    nowMs: NOW,
    ...overrides,
  });
}

describe('rules', () => {
  test('defaults match the SPEC and commission overrides win over the course', () => {
    expect(DEFAULT_RULES).toMatchObject({ min_attendance: 0.75, promotion_ok_ratio: 0.8, late_tolerance_hours: 48 });
    const course = { grading_rules: { promotion_grade: 8 }, grading_rules_by_commission: { 'Comisión 2': { promotion_grade: 7, allow_promotion_via_recovery: true } } };
    expect(resolveRules(course).promotion_grade).toBe(8);
    expect(resolveRules(course, 'Comisión 2')).toMatchObject({ promotion_grade: 7, allow_promotion_via_recovery: true });
    expect(resolveRules(course, 'Comisión 9').promotion_grade).toBe(8);
  });
});

describe('deadlines (calendar hours, Argentina time)', () => {
  test('date-only due dates end at 23:59:59 ART, not UTC', () => {
    expect(new Date(dueAtMs('2026-05-01')).toISOString()).toBe('2026-05-02T02:59:59.000Z');
  });

  test('tolerance and extensions are calendar hours', () => {
    const due = '2026-05-01'; // vie 23:59:59
    expect(lateness(Date.parse('2026-05-03T23:00:00-03:00'), due, 48).late).toBe(false); // dom, dentro de 48 h
    expect(lateness(Date.parse('2026-05-04T01:00:00-03:00'), due, 48)).toEqual({ late: true, lateByHours: 2 });
    expect(lateness(Date.parse('2026-05-04T01:00:00-03:00'), due, 48, 24).late).toBe(false);
    expect(lateness(null, due, 48).late).toBe(false);
    expect(lateness(Date.now(), '', 48).late).toBe(false);
    expect(isPastDeadline(NOW, due, 48)).toBe(true);
    expect(isPastDeadline(NOW, '', 48)).toBe(false);
  });
});

describe('computeAcademicCondition', () => {
  test('meets every criterion: Promocionado', () => {
    const r = run();
    expect(r.condition).toBe(CONDITIONS.PROMOCIONADO);
    expect(r.reasons).toEqual([]);
    expect(r.attendance).toMatchObject({ status: 'ok', ratio: 1, held: 4 });
  });

  test('regular but below the promotion grade: Regular with a reason', () => {
    const r = run({ assessmentGrades: { p1: { grade: '6' }, p2: { grade: '9' } } });
    expect(r.condition).toBe(CONDITIONS.REGULAR);
    expect(r.reasons).toEqual(['P1: 6 (para promocionar hace falta 7).']);
    expect(r.near_promotion).toBe(true); // a 1 punto
  });

  test('low attendance puts the student at risk', () => {
    const r = run({ attendance: classes(2) });
    expect(r.condition).toBe(CONDITIONS.EN_RIESGO);
    expect(r.reasons[0]).toBe('Asistencia 50% (mínimo 75%).');
    expect(r.attendance.classes_to_recover).toBe(4);
    expect(r.attendance.absence_streak).toBe(2);
  });

  test('attendance is not judged before the minimum number of classes', () => {
    const r = run({ attendance: classes(0, 2) });
    expect(r.attendance.status).toBe('pending');
    expect(r.condition).toBe(CONDITIONS.CONDICIONAL);
  });

  test('justified absences leave the denominator; a waiver exempts attendance', () => {
    expect(run({ attendance: classes(3, 4, { 4: 'justified' }) }).attendance).toMatchObject({ ratio: 1, justified: 1 });
    const waived = run({ attendance: classes(1), exceptions: [{ type: 'attendance_waiver' }] });
    expect(waived.attendance).toMatchObject({ status: 'ok', waived: true });
    expect(waived.condition).toBe(CONDITIONS.PROMOCIONADO);
  });

  test('a revoked waiver no longer counts', () => {
    expect(run({ attendance: classes(1), exceptions: [{ type: 'attendance_waiver', revoked: true }] }).condition)
      .toBe(CONDITIONS.EN_RIESGO);
  });

  test('an overdue required TP without delivery breaks regularity', () => {
    const r = run({ submissions: { tp1: ok() } });
    expect(r.condition).toBe(CONDITIONS.EN_RIESGO);
    expect(r.reasons).toContain('TP «TP2» vencido sin entregar.');
    expect(r.near_regularity).toBe(true);
  });

  test('a TP not yet due is pending, not missing', () => {
    const r = run({ assignments: [tp('tp1'), tp('tp2', '2026-07-15')], submissions: { tp1: ok() } });
    expect(r.tps.status).toBe('pending');
    expect(r.condition).toBe(CONDITIONS.CONDICIONAL);
  });

  test('optional TPs do not count; an exempted TP neither (up to max_exempt_tps)', () => {
    expect(run({ assignments: [tp('tp1'), tp('tp2', '2026-05-01', { is_required: false })], submissions: { tp1: ok() } }).condition)
      .toBe(CONDITIONS.PROMOCIONADO);
    const exempt = (ids) => ids.map((id) => ({ type: 'tp_exempt', assignment_id: id }));
    const one = run({ submissions: { tp1: ok() }, exceptions: exempt(['tp2']) });
    expect(one.condition).toBe(CONDITIONS.PROMOCIONADO);
    expect(one.tps.exempt).toEqual(['tp2']);
    // Only the first exemption applies with the default max_exempt_tps = 1.
    expect(run({ submissions: {}, exceptions: exempt(['tp1', 'tp2']) }).condition).toBe(CONDITIONS.EN_RIESGO);
  });

  test('promotion needs the configured share of TPs in OK', () => {
    const five = ['tp1', 'tp2', 'tp3', 'tp4', 'tp5'].map((id) => tp(id));
    const subs = { tp1: ok(), tp2: ok(), tp3: ok(), tp4: ok('3'), tp5: ok('2') };
    const r = run({ assignments: five, submissions: subs });
    expect(r.condition).toBe(CONDITIONS.REGULAR);
    expect(r.tps.ok_ratio).toMatchObject({ approved: 3, needed: 4, status: 'failed' });
    expect(r.near_promotion).toBe(true);
    // Conceptual "Aprobado" counts as OK; an ungraded delivery is still open.
    expect(run({ submissions: { tp1: ok('Aprobado'), tp2: ok('') } }).promotion.ok_ratio).toBe('pending');
  });

  test('late submissions beyond the allowance block promotion only', () => {
    const late = { status: 'submitted', submitted_at: Date.parse('2026-05-10T10:00:00-03:00'), grade: '9' };
    const r = run({ submissions: { tp1: late, tp2: { ...late, late: true } } });
    expect(r.tps.late).toMatchObject({ count: 2, max: 1, status: 'failed' });
    expect(r.condition).toBe(CONDITIONS.REGULAR);
    expect(r.reasons).toContain('2 entregas fuera de término (máximo 1 para promocionar).');
    // A 10-day extension makes it on time.
    const ext = run({ submissions: { tp1: late, tp2: ok() }, exceptions: [{ type: 'deadline_extension', assignment_id: 'tp1', extra_hours: 240 }] });
    expect(ext.tps.late.count).toBe(0);
  });

  test('a failed partial is recovered by its recuperatorio', () => {
    const base = { assessments: [parcial('p1', 'P1'), parcial('p2', 'P2'), recup('r1', 'R1', 'p1')] };
    const pending = run({ ...base, assessmentGrades: { p1: { grade: '2' }, p2: { grade: '9' } } });
    expect(pending.condition).toBe(CONDITIONS.CONDICIONAL); // R1 sin nota todavía

    const failed = run({ ...base, assessmentGrades: { p1: { grade: '2' }, r1: { grade: '3,5' }, p2: { grade: '9' } } });
    expect(failed.condition).toBe(CONDITIONS.EN_RIESGO);
    expect(failed.reasons).toContain('P1: 3,5 (se aprueba con 4).');
    expect(failed.near_regularity).toBe(true);

    const recovered = run({ ...base, assessmentGrades: { p1: { grade: '2' }, r1: { grade: '8' }, p2: { grade: '9' } } });
    expect(recovered.condition).toBe(CONDITIONS.REGULAR);
    expect(recovered.reasons).toContain('P1: aprobado en recuperatorio; esta comisión no promociona por recuperatorio.');
  });

  test('promotion via recuperatorio when the commission allows it', () => {
    const r = run({
      course: { grading_rules_by_commission: { C2: { allow_promotion_via_recovery: true } } },
      commission: 'C2',
      assessments: [parcial('p1', 'P1'), parcial('p2', 'P2'), recup('r1', 'R1', 'p1')],
      assessmentGrades: { p1: { grade: '5' }, r1: { grade: '8' }, p2: { grade: '9' } },
    });
    expect(r.condition).toBe(CONDITIONS.PROMOCIONADO);
  });

  test('absent at a partial without recovery is failed', () => {
    const r = run({ assessmentGrades: { p1: { absent: true }, p2: { grade: '9' } } });
    expect(r.condition).toBe(CONDITIONS.EN_RIESGO);
    expect(r.reasons).toContain('P1: ausente sin recuperar.');
  });

  test('no activity at all after the minimum classes: Ausente; removed from roster: Baja', () => {
    const none = { attendance: classes(0), submissions: {}, assessmentGrades: {} };
    expect(run(none).condition).toBe(CONDITIONS.AUSENTE);
    expect(run({ rosterStatus: 'removed' }).condition).toBe(CONDITIONS.BAJA);
  });

  test('simulated rules override the stored ones', () => {
    expect(run({ assessmentGrades: { p1: { grade: '7' }, p2: { grade: '7' } }, rulesOverride: { promotion_grade: 8 } }).condition)
      .toBe(CONDITIONS.REGULAR);
  });

  test('without TPs or partials loaded, those criteria do not block', () => {
    const r = run({ assignments: [], submissions: {}, assessments: [], assessmentGrades: {} });
    expect(r.regularity).toEqual({ attendance: 'ok', tps: 'na', partials: 'na' });
    expect(r.condition).toBe(CONDITIONS.PROMOCIONADO);
  });
});
