/** Cátedra de ejemplo compartida por los tests de retención. */
const { memoryDb, handlerContext } = require('./memoryDb');
const { authorizeAction } = require('../../src/authz');

function seed() {
  return memoryDb({
    'courses/c1': { name: 'Programación I' },
    'profiles/t1': { role: 'teacher', full_name: 'Docente' },
    'profiles/s1': { role: 'student', full_name: 'Ana', moodle_user_id: '19284' },
    'profiles/s2': { role: 'student', full_name: 'Beto' },
    'course_teachers/c1_t1': { course_id: 'c1', teacher_id: 't1', role: 'titular' },
    'course_roster/c1_s1': { course_id: 'c1', student_id: 's1', status: 'approved' },
    'course_roster/c1_s2': { course_id: 'c1', student_id: 's2', status: 'approved' },
    'assignments/a1': { course_id: 'c1', title: 'TP1', due_date: '2026-03-01' },
    'courses/c1/attendance/class_1': { classNumber: 1, records: { s1: 'absent', s2: 'present' } },
    'courses/c1/attendance/class_2': { classNumber: 2, records: { s1: 'absent', s2: 'present' } },
    'courses/c1/attendance/class_3': { classNumber: 3, records: { s1: 'absent', s2: 'present' } },
    'courses/c1/class_comments/k1': { classNumber: 2, user_id: 's2', content: 'Respuesta', is_best_answer: false },
    'courses/c1/class_comments/k2': { classNumber: 2, user_id: 's1', content: 'Otra', is_best_answer: true },
  });
}

const call = async (db, uid, action, handler, payload) => {
  const authorized = await authorizeAction(action, payload, { uid, db, profile: db.docs[`profiles/${uid}`] });
  return handler(authorized, handlerContext(db, uid));
};

module.exports = { seed, call };
