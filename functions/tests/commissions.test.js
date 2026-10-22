const { memoryDb, handlerContext } = require('./helpers/memoryDb');
const { authorizeAction } = require('../src/authz');
const attendance = require('../src/modules/attendance/attendance');
const commissions = require('../src/modules/course/commissions');
const assessments = require('../src/modules/course/assessments');
const assignments = require('../src/modules/github/assignments');
const exceptions = require('../src/modules/course/exceptions');
const academic = require('../src/modules/course/academic');
const courses = require('../src/modules/course/courses');

const HANDLERS = { ...attendance, ...commissions, ...assessments, ...assignments, ...exceptions, ...academic, ...courses };

function seed() {
  return memoryDb({
    'courses/c1': { name: 'Programación I', commissions: ['Comisión 1', 'Comisión 2'] },
    'profiles/titular': { role: 'teacher', full_name: 'Titular' },
    'profiles/ta1': { role: 'teacher', full_name: 'Ayudante C1', gmail_refresh_token: 'enc:secret' },
    'profiles/ana': { role: 'student', commissions: { c1: 'Comisión 1' } },
    'profiles/beto': { role: 'student', commissions: { c1: 'Comisión 2' } },
    'course_teachers/c1_titular': { course_id: 'c1', teacher_id: 'titular', role: 'titular' },
    'course_teachers/c1_ta1': { course_id: 'c1', teacher_id: 'ta1', role: 'ayudante', commissions: ['Comisión 1'] },
    'course_roster/c1_ana': { course_id: 'c1', student_id: 'ana', status: 'approved' },
    'course_roster/c1_beto': { course_id: 'c1', student_id: 'beto', status: 'approved' },
    'assignments/a1': { course_id: 'c1', title: 'TP 1' },
    'submissions/s_ana': { assignment_id: 'a1', student_id: 'ana' },
    'submissions/s_beto': { assignment_id: 'a1', student_id: 'beto' },
    'assessments/p1': { course_id: 'c1', kind: 'parcial', label: 'P1' },
  });
}

const call = async (db, uid, action, payload) => {
  const authorized = await authorizeAction(action, payload, { uid, db, profile: db.docs[`profiles/${uid}`] });
  return HANDLERS[action](authorized, handlerContext(db, uid));
};

describe('ayudante restringido a su comisión (plan F0.4)', () => {
  test('grades and takes attendance only for their commission', async () => {
    const db = seed();
    await call(db, 'ta1', 'gradeSubmission', { submissionId: 's_ana', grade: 8 });
    await expect(call(db, 'ta1', 'gradeSubmission', { submissionId: 's_beto', grade: 8 })).rejects.toMatchObject({ code: 'permission-denied' });
    expect(db.docs['submissions/s_beto'].grade).toBeUndefined();

    await call(db, 'ta1', 'saveClassAttendance', { courseId: 'c1', classNumber: 1, records: { ana: 'present' } });
    await expect(call(db, 'ta1', 'saveClassAttendance', { courseId: 'c1', classNumber: 1, records: { beto: 'absent' } }))
      .rejects.toMatchObject({ code: 'permission-denied' });
    expect(db.docs['courses/c1/attendance/class_1'].records).toEqual({ ana: 'present' });

    // El titular no tiene restricción y la planilla se mezcla, no se pisa.
    await call(db, 'titular', 'saveClassAttendance', { courseId: 'c1', classNumber: 1, records: { beto: 'justified' } });
    expect(db.docs['courses/c1/attendance/class_1'].records).toEqual({ ana: 'present', beto: 'justified' });
  });

  test('assessments, exceptions and the conditions table follow the same scope', async () => {
    const db = seed();
    await expect(call(db, 'ta1', 'gradeAssessment', { assessmentId: 'p1', studentId: 'beto', grade: 7 })).rejects.toMatchObject({ code: 'permission-denied' });
    const res = await call(db, 'ta1', 'importAssessmentGrades', { assessmentId: 'p1', rows: [{ studentId: 'ana', grade: 9 }, { studentId: 'beto', grade: 2 }] });
    expect(res.updated).toBe(1);
    expect(res.rejected[0].reason).toMatch(/comisión/);
    await expect(call(db, 'ta1', 'grantException', { courseId: 'c1', studentId: 'beto', type: 'attendance_waiver', reason: 'Certificado médico' }))
      .rejects.toMatchObject({ code: 'permission-denied' });

    const table = await call(db, 'ta1', 'getAcademicConditions', { courseId: 'c1' });
    expect(table.results.map((r) => r.student_id)).toEqual(['ana']);
    expect((await call(db, 'titular', 'getAcademicConditions', { courseId: 'c1' })).results).toHaveLength(2);
  });

  test('only the titular moves students between commissions and assigns TA commissions', async () => {
    const db = seed();
    await expect(call(db, 'ta1', 'setStudentCommission', { courseId: 'c1', studentId: 'beto', commission: 'Comisión 1' }))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(call(db, 'titular', 'setStudentCommission', { courseId: 'c1', studentId: 'beto', commission: 'Comisión 9' }))
      .rejects.toMatchObject({ code: 'invalid-argument' });
    await call(db, 'titular', 'setStudentCommission', { courseId: 'c1', studentId: 'beto', commission: 'Comisión 1' });
    expect(db.docs['profiles/beto'].commissions.c1).toBe('Comisión 1');

    await expect(call(db, 'ta1', 'setTeacherCommissions', { courseId: 'c1', teacherId: 'ta1', commissions: ['Comisión 2'] }))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await call(db, 'titular', 'setTeacherCommissions', { courseId: 'c1', teacherId: 'ta1', commissions: ['Comisión 2'] });
    expect(db.docs['course_teachers/c1_ta1'].commissions).toEqual(['Comisión 2']);
  });

  test('the teacher list exposes role and commissions but never full profiles', async () => {
    const db = seed();
    const list = await call(db, 'ana', 'getCourseTeachers', { courseId: 'c1' });
    const ta = list.find((t) => t.teacher_id === 'ta1');
    expect(ta).toMatchObject({ role: 'ayudante', commissions: ['Comisión 1'], profiles: { full_name: 'Ayudante C1' } });
    expect(JSON.stringify(list)).not.toMatch(/gmail_refresh_token/);
  });
});
