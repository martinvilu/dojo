const { getCourseDetails, getStudentCourses, getCourseRoster } = require('../src/modules/course/courses');

const COURSE = {
  name: 'Algoritmos',
  sync_secret: 'SYNC',
  invite_code: 'STU123',
  teacher_invite_code: 'T-SECRET',
  assistant_invite_code: 'A-SECRET',
  github_token: 'ghp_secret'
};

// Firestore double: "collection/docId" -> data, plus where() on course_roster
// and enrollments filtered by the first equality clause.
function createContext(uid, role, extraDocs = {}) {
  const docs = {
    'courses/c1': { ...COURSE },
    'course_roster/c1_student1': { course_id: 'c1', student_id: 'student1' },
    'course_teachers/c1_teacher1': { course_id: 'c1', teacher_id: 'teacher1' },
    'profiles/student1': { full_name: 'Ana', email: 'ana@unrn.edu.ar', matricula_unrn: '123', role: 'student' },
    ...extraDocs
  };
  const updates = [];
  const db = {
    collection: (name) => ({
      doc: (id) => ({
        get: async () => ({ id, exists: docs[`${name}/${id}`] !== undefined, data: () => docs[`${name}/${id}`] }),
        update: async (data) => {
          updates.push({ path: `${name}/${id}`, data });
          Object.assign(docs[`${name}/${id}`], data);
        }
      }),
      where: (field, op, value) => {
        const matching = () => Object.entries(docs)
          .filter(([path, data]) => path.startsWith(`${name}/`) && data[field] === value)
          .map(([path, data]) => ({ id: path.split('/')[1], data: () => data }));
        const query = {
          where: () => query,
          get: async () => { const d = matching(); return { docs: d, empty: d.length === 0 }; }
        };
        return query;
      }
    })
  };
  return { uid, db, updates, getMyProfile: async () => ({ role }) };
}

describe('course data visibility for students', () => {
  test('getCourseDetails hides secrets and teacher invite codes from students', async () => {
    const ctx = createContext('student1', 'student');
    const course = await getCourseDetails({ courseId: 'c1' }, ctx);
    expect(course.name).toBe('Algoritmos');
    expect(course.sync_secret).toBeUndefined();
    expect(course.teacher_invite_code).toBeUndefined();
    expect(course.assistant_invite_code).toBeUndefined();
    expect(course.github_token).toBeUndefined();
    expect(course.calendar_secret).toMatch(/^[0-9A-F]{32}$/);
  });

  test('getCourseDetails keeps the full settings for course teachers', async () => {
    const ctx = createContext('teacher1', 'teacher');
    const course = await getCourseDetails({ courseId: 'c1' }, ctx);
    expect(course.sync_secret).toBe('SYNC');
    expect(course.teacher_invite_code).toBe('T-SECRET');
  });

  test('getStudentCourses exposes a calendar-only token instead of sync_secret', async () => {
    const ctx = createContext('student1', 'student');
    const [course] = await getStudentCourses({}, ctx);
    expect(course.sync_secret).toBeUndefined();
    expect(course.calendar_secret).toMatch(/^[0-9A-F]{32}$/);
    // Generated once and persisted, so the feed URL stays stable.
    const [again] = await getStudentCourses({}, ctx);
    expect(again.calendar_secret).toBe(course.calendar_secret);
    expect(ctx.updates.filter((u) => u.data.calendar_secret)).toHaveLength(1);
  });

  test('getCourseRoster only shares peer-safe profile fields with students', async () => {
    const [peer] = await getCourseRoster({ courseId: 'c1' }, createContext('student1', 'student'));
    expect(peer.full_name).toBe('Ana');
    expect(peer.matricula_unrn).toBeUndefined();

    const [full] = await getCourseRoster({ courseId: 'c1' }, createContext('teacher1', 'teacher'));
    expect(full.matricula_unrn).toBe('123');
  });
});
