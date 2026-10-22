const { detectAlerts, reconcileAlert, ALERT_TYPES } = require('../src/lib/academic/alerts');
const { DEFAULT_RULES } = require('../src/lib/academic/rules');
const alerts = require('../src/modules/notifications/alerts');
const moodleLogs = require('../src/modules/integrations/moodleLogs');
const { seed, call } = require('./helpers/courseSeed');

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-06-15T12:00:00-03:00');

function cond(overrides = {}) {
  return {
    condition: 'Condicional',
    attendance: { status: 'ok', ratio: 0.9, required: 0.75, absence_streak: 0, waived: false },
    tps: { missing: [], exempt: [] },
    ...overrides,
  };
}

describe('detectAlerts', () => {
  const base = { rules: DEFAULT_RULES, assignments: [], submissions: {}, lastMoodleActivityMs: null, nowMs: NOW };

  test('critical attendance by ratio or by consecutive absences', () => {
    expect(detectAlerts({ ...base, condition: cond({ attendance: { status: 'failed', ratio: 0.5, required: 0.75, absence_streak: 0 } }) }))
      .toEqual([{ type: ALERT_TYPES.ATTENDANCE, message: 'Asistencia 50% (mínimo 75%).' }]);
    expect(detectAlerts({ ...base, condition: cond({ attendance: { status: 'ok', ratio: 0.8, required: 0.75, absence_streak: 2 } }) })[0].message)
      .toBe('2 inasistencias seguidas.');
    expect(detectAlerts({ ...base, condition: cond({ attendance: { status: 'failed', ratio: 0.1, waived: true, absence_streak: 9 } }) })).toEqual([]);
  });

  test('overdue TPs and missing repositories after N days', () => {
    const assignments = [
      { id: 'a1', title: 'TP1', template_repo: 'org/tp1', created_at: new Date(NOW - 8 * DAY), due_date: '2026-07-01' },
      { id: 'a2', title: 'TP2', template_repo: 'org/tp2', created_at: new Date(NOW - 3 * DAY), due_date: '2026-07-01' },
    ];
    const found = detectAlerts({ ...base, assignments, condition: cond({ tps: { missing: ['TP0'], exempt: [] } }) });
    expect(found.map((a) => a.type)).toEqual([ALERT_TYPES.OVERDUE, ALERT_TYPES.NO_REPO]);
    expect(found[1].message).toContain('TP1');
    expect(found[1].message).not.toContain('TP2');
    expect(detectAlerts({ ...base, assignments, submissions: { a1: {} }, condition: cond() }).map((a) => a.type)).toEqual([]);
  });

  test('silent dropout: recent Moodle activity but nothing started in the open practice', () => {
    const assignments = [{ id: 'a1', title: 'TP1', created_at: new Date(NOW - 2 * DAY), due_date: '2026-07-01' }];
    const silent = detectAlerts({ ...base, assignments, lastMoodleActivityMs: NOW - DAY, condition: cond() });
    expect(silent).toEqual([{ type: ALERT_TYPES.SILENT, message: 'Activo en Moodle hace 1 día pero sin repositorio ni entrega en la práctica activa.' }]);
    expect(detectAlerts({ ...base, assignments, lastMoodleActivityMs: NOW - 20 * DAY, condition: cond() })).toEqual([]);
    expect(detectAlerts({ ...base, assignments, submissions: { a1: {} }, lastMoodleActivityMs: NOW - DAY, condition: cond() })).toEqual([]);
  });

  test('no alerts for students who left the course', () => {
    expect(detectAlerts({ ...base, condition: cond({ condition: 'Baja', tps: { missing: ['TP1'], exempt: [] } }) })).toEqual([]);
  });
});

describe('reconcileAlert', () => {
  const detected = { message: 'x' };
  test('creates, keeps contacted and snoozed alerts, reopens resolved ones and auto-resolves', () => {
    expect(reconcileAlert(undefined, detected, NOW).op).toBe('create');
    expect(reconcileAlert({ status: 'contacted' }, detected, NOW).data).not.toHaveProperty('status');
    expect(reconcileAlert({ status: 'snoozed', snoozed_until: new Date(NOW + DAY) }, detected, NOW).data).not.toHaveProperty('status');
    expect(reconcileAlert({ status: 'snoozed', snoozed_until: new Date(NOW - DAY) }, detected, NOW).data.status).toBe('active');
    expect(reconcileAlert({ status: 'resolved' }, detected, NOW).data).toMatchObject({ status: 'active', reopened: true });
    expect(reconcileAlert({ status: 'contacted' }, undefined, NOW).data).toMatchObject({ status: 'resolved', resolved_by: 'system' });
    expect(reconcileAlert({ status: 'resolved' }, undefined, NOW).op).toBe('none');
  });
});

describe('persistent alerts and contact log', () => {
  test('refresh creates alerts once, respects snooze and auto-resolves', async () => {
    const db = seed();
    await expect(call(db, 's1', 'refreshStudentAlerts', alerts.refreshStudentAlerts, { courseId: 'c1' })).rejects.toMatchObject({ code: 'permission-denied' });
    const first = await call(db, 't1', 'refreshStudentAlerts', alerts.refreshStudentAlerts, { courseId: 'c1' });
    expect(first.created).toBeGreaterThanOrEqual(2);
    expect(db.docs['student_alerts/c1_s1_attendance_critical'].status).toBe('active');

    await call(db, 't1', 'updateStudentAlert', alerts.updateStudentAlert, { alertId: 'c1_s1_attendance_critical', action: 'snooze', days: 3 });
    await call(db, 't1', 'refreshStudentAlerts', alerts.refreshStudentAlerts, { courseId: 'c1' });
    expect(db.docs['student_alerts/c1_s1_attendance_critical'].status).toBe('snoozed');

    // The student comes back: attendance alert resolves on its own.
    for (const n of [4, 5, 6, 7, 8, 9, 10, 11, 12]) db.docs[`courses/c1/attendance/class_${n}`] = { classNumber: n, records: { s1: 'present', s2: 'present' } };
    await call(db, 't1', 'refreshStudentAlerts', alerts.refreshStudentAlerts, { courseId: 'c1' });
    expect(db.docs['student_alerts/c1_s1_attendance_critical']).toMatchObject({ status: 'resolved', resolved_by: 'system' });

    const list = await call(db, 't1', 'getStudentAlerts', alerts.getStudentAlerts, { courseId: 'c1' });
    expect(list.every((a) => a.status !== 'resolved')).toBe(true);
    expect(list.find((a) => a.type === 'overdue_tps')).toMatchObject({ full_name: 'Ana', label: 'Tareas atrasadas' });
  });

  test('marking as contacted writes an immutable contact log; tutoring notifies the student', async () => {
    const db = seed();
    await call(db, 't1', 'refreshStudentAlerts', alerts.refreshStudentAlerts, { courseId: 'c1' });
    await call(db, 't1', 'updateStudentAlert', alerts.updateStudentAlert,
      { alertId: 'c1_s1_overdue_tps', action: 'contacted', channel: 'discord', summary: 'Le escribí por Discord' });
    expect(db.docs['student_alerts/c1_s1_overdue_tps'].status).toBe('contacted');
    await call(db, 't1', 'scheduleStudentTutoring', alerts.scheduleStudentTutoring,
      { courseId: 'c1', studentId: 's1', dateTime: '2026-06-20T15:00:00-03:00', note: 'Repaso de Git' });
    const logs = await call(db, 't1', 'getContactLogs', alerts.getContactLogs, { courseId: 'c1', studentId: 's1' });
    expect(logs.map((l) => l.channel).sort()).toEqual(['discord', 'tutoria']);
    expect(Object.values(db.docs).some((d) => d.student_id === 's1' && /tutoría/.test(d.message || ''))).toBe(true);
    await expect(call(db, 't1', 'addContactLog', alerts.addContactLog, { courseId: 'c1', studentId: 'nobody', channel: 'email', summary: 'hola' }))
      .rejects.toThrow(/no pertenece/);
  });
});

describe('Moodle log import', () => {
  test('is idempotent across overlapping files and updates the last Moodle activity', async () => {
    const db = seed();
    const events = [
      { userId: '19284', time: '10/06/26, 10:00', timeMs: Date.parse('2026-06-10T10:00:00-03:00'), eventName: 'Curso visto', context: 'Curso: Prog I' },
      { userId: '19284', time: '11/06/26, 09:30', timeMs: Date.parse('2026-06-11T09:30:00-03:00'), eventName: 'Recurso visto', context: 'Archivo: TP1' },
      { userId: '777', time: '11/06/26, 09:31', timeMs: null, eventName: 'Curso visto', context: 'Curso: Prog I' },
    ];
    const first = await call(db, 't1', 'importMoodleLogs', moodleLogs.importMoodleLogs, { courseId: 'c1', events });
    expect(first).toMatchObject({ received: 3, inserted: 3, matchedStudents: 1, unmatchedUserIds: ['777'] });
    expect(db.docs['profiles/s1'].ultima_actividad_moodle.getTime()).toBe(Date.parse('2026-06-11T09:30:00-03:00'));

    const again = await call(db, 't1', 'importMoodleLogs', moodleLogs.importMoodleLogs, { courseId: 'c1', events: events.slice(1) });
    expect(again).toMatchObject({ inserted: 0, duplicates: 2 });
  });
});
