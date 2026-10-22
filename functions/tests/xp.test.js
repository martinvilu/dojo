const { computeXp, xpEvents, rankFor } = require('../src/lib/xp');
const { memoryDb, handlerContext } = require('./helpers/memoryDb');
const { authorizeAction } = require('../src/authz');
const xpActions = require('../src/modules/auth/xp');
const attendance = require('../src/modules/attendance/attendance');

const call = async (db, uid, action, payload) => {
  const authorized = await authorizeAction(action, payload, { uid, db, profile: db.docs[`profiles/${uid}`] });
  return xpActions[action](authorized, handlerContext(db, uid));
};

describe('lib/xp', () => {
  test('applies the SPEC formula, including partial grades', () => {
    const xp = computeXp({
      studentId: 's1',
      attendance: [
        { classNumber: 1, records: { s1: 'present' } },
        { classNumber: 2, records: { s1: 'late' } },
        { classNumber: 3, records: { s1: 'absent' } },
      ],
      submissions: [{ assignment_id: 'a1', grade: '8' }, { assignment_id: 'a2', grade: 'Aprobado' }],
      assessmentGrades: [{ grade: 6, label: 'P1' }, { grade: 9, absent: true }],
      comments: [{ user_id: 's1', classNumber: 1, is_solution: true }, { user_id: 's2', classNumber: 1 }],
    });
    // 2·10 + 2·50 + (8 + 6)·5 + 1·10 + 1·100
    expect(xp.totalXp).toBe(20 + 100 + 70 + 10 + 100);
    expect(xp.level).toBe(4);
    expect(xp.levelProgress).toBe(0);
    expect(xp.rank).toBe('Chūnin');
    expect(xp.breakdown).toEqual({ asistencia: 20, entrega: 100, nota: 70, comentario: 10, solucion: 100 });
    expect(xp.badges).toEqual({ chakraMaster: false, perfectAttendance: false, activeNinja: false, solver: true });
  });

  test('legacy is_best_answer counts as a solution and conceptual grades do not add', () => {
    const events = xpEvents({ studentId: 's1', comments: [{ user_id: 's1', classNumber: 4, is_best_answer: true }], submissions: [{ grade: 'Promocionado' }] });
    expect(events.map((e) => e.action)).toEqual(['entrega', 'comentario', 'solucion']);
  });

  test('ranks and badges', () => {
    expect([1, 2, 3, 4, 5, 9].map(rankFor)).toEqual(['Genin', 'Genin', 'Chūnin', 'Chūnin', 'Jōnin', 'Jōnin']);
    const perfect = computeXp({
      studentId: 's1',
      attendance: [1, 2, 3].map((n) => ({ classNumber: n, records: { s1: 'present' } })),
      submissions: [{ grade: 9.5 }],
      comments: [1, 2, 3].map((n) => ({ user_id: 's1', classNumber: n })),
    });
    expect(perfect.badges).toEqual({ chakraMaster: true, perfectAttendance: true, activeNinja: true, solver: false });
    expect(computeXp({ studentId: 'x' })).toMatchObject({ totalXp: 0, level: 1, rank: 'Genin' });
  });
});

describe('XP actions', () => {
  const seed = () => memoryDb({
    'courses/c1': { name: 'Programación I' },
    'profiles/t1': { role: 'teacher' },
    'profiles/s1': { role: 'student', commissions: { c1: 'Comisión 1' } },
    'course_teachers/c1_t1': { course_id: 'c1', teacher_id: 't1', role: 'titular' },
    'course_roster/c1_s1': { course_id: 'c1', student_id: 's1', status: 'approved' },
    'courses/c1/attendance/class_1': { classNumber: 1, records: { s1: 'present' } },
    'assignments/a1': { course_id: 'c1', title: 'TP 1' },
    'submissions/sub1': { assignment_id: 'a1', student_id: 's1', grade: '7' },
    'submissions/sub0': { assignment_id: 'a1', student_id: 's1' },
    'assessments/p1': { course_id: 'c1', label: 'P1', kind: 'parcial' },
    'assessments/p2': { course_id: 'c1', label: 'P2 C2', kind: 'parcial', commission: 'Comisión 2' },
    'assessment_grades/p1_s1': { course_id: 'c1', assessment_id: 'p1', student_id: 's1', grade: 8 },
    'assessment_grades/p2_s1': { course_id: 'c1', assessment_id: 'p2', student_id: 's1', grade: 10 },
    'courses/c1/class_comments/k1': { classNumber: 1, user_id: 's1', is_solution: true },
  });

  test('getMyXp matches the client formula and counts partials of the own commission only', async () => {
    const db = seed();
    const xp = await call(db, 's1', 'getMyXp', { courseId: 'c1' });
    // 10 + 50 (una entrega por TP) + (7 + 8)·5 + 10 + 100
    expect(xp.totalXp).toBe(10 + 50 + 75 + 10 + 100);
    expect(await call(db, 't1', 'getMyXp', { courseId: 'c1' })).toBeNull();
  });

  test('getXpLogs derives the log from data across the student courses', async () => {
    const db = seed();
    const logs = await call(db, 's1', 'getXpLogs', {});
    expect(logs.reduce((sum, l) => sum + l.points, 0)).toBe(245);
    expect(logs.find((l) => l.action === 'nota' && /P1/.test(l.description))).toBeTruthy();
  });

  test('QR attendance no longer writes xp_logs', () => {
    expect(String(attendance.submitQrAttendance)).not.toMatch(/xp_logs/);
  });
});
