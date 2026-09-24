const { ACTION_MODULES } = require('../src/actions');
const { ACTION_POLICIES, authorizeAction } = require('../src/authz');

// Minimal Firestore double backed by a "collection/docId" -> data map.
function fakeDb(docs) {
  return {
    collection: (name) => ({
      doc: (id) => ({
        get: async () => {
          const data = docs[`${name}/${id}`];
          return { exists: data !== undefined, data: () => data };
        }
      })
    })
  };
}

const docs = {
  'course_teachers/c1_teacher1': { course_id: 'c1', teacher_id: 'teacher1' },
  'course_roster/c1_student1': { course_id: 'c1', student_id: 'student1' },
  'enrollments/student2_c1': { course_id: 'c1', student_id: 'student2' },
  'assignments/a1': { course_id: 'c1' },
  'submissions/s1': { assignment_id: 'a1', student_id: 'student1' },
  'study_groups/g1': { course_id: 'c1' },
  'announcements/n1': { course_id: 'c1' },
  'scheduled_emails/e1': { course_id: 'c1' }
};
const db = fakeDb(docs);

const as = (uid, role) => ({ uid, db, profile: role ? { role } : null });
const denied = { code: 'permission-denied' };

describe('authz policy table', () => {
  test('every registered action declares an access policy', () => {
    const missing = Object.keys(ACTION_MODULES).filter((a) => !ACTION_POLICIES[a]);
    expect(missing).toEqual([]);
  });

  test('there are no policies for unregistered actions', () => {
    const orphans = Object.keys(ACTION_POLICIES).filter((a) => !ACTION_MODULES[a]);
    expect(orphans).toEqual([]);
  });

  test('actions without a policy are rejected (fail closed)', async () => {
    await expect(authorizeAction('notARealAction', {}, as('admin1', 'admin'))).rejects.toMatchObject(denied);
  });
});

describe('authorizeAction', () => {
  test('admin-only actions reject teachers and students', async () => {
    const payload = { userId: 'victim', data: { role: 'admin' } };
    await expect(authorizeAction('updateUserProfile', payload, as('student1', 'student'))).rejects.toMatchObject(denied);
    await expect(authorizeAction('updateUserProfile', payload, as('teacher1', 'teacher'))).rejects.toMatchObject(denied);
    await expect(authorizeAction('updateUserProfile', payload, as('admin1', 'admin'))).resolves.toBe(payload);
  });

  test('staff actions reject students and callers without a profile', async () => {
    await expect(authorizeAction('getTeacherCourses', {}, as('student1', 'student'))).rejects.toMatchObject(denied);
    await expect(authorizeAction('getTeacherCourses', {}, as('ghost'))).rejects.toMatchObject(denied);
    await expect(authorizeAction('getTeacherCourses', {}, as('teacher1', 'teacher'))).resolves.toEqual({});
  });

  test('course staff actions require a teacher assignment on that course', async () => {
    const payload = { courseId: 'c1', name: 'Renamed' };
    await expect(authorizeAction('updateCourseName', payload, as('teacher1', 'teacher'))).resolves.toBe(payload);
    await expect(authorizeAction('updateCourseName', payload, as('teacher2', 'teacher'))).rejects.toMatchObject(denied);
    await expect(authorizeAction('updateCourseName', payload, as('student1', 'student'))).rejects.toMatchObject(denied);
    await expect(authorizeAction('updateCourseName', payload, as('admin1', 'admin'))).resolves.toBe(payload);
  });

  test('course is resolved from submissions through their assignment', async () => {
    const payload = { submissionId: 's1', grade: '10' };
    await expect(authorizeAction('gradeSubmission', payload, as('teacher1', 'teacher'))).resolves.toBe(payload);
    await expect(authorizeAction('gradeSubmission', payload, as('student1', 'student'))).rejects.toMatchObject(denied);
    await expect(authorizeAction('gradeSubmission', { submissionId: 'missing' }, as('teacher1', 'teacher')))
      .rejects.toMatchObject({ code: 'not-found' });
  });

  test('every target of a multi-target policy is checked', async () => {
    // teacher1 teaches c1 but not c2: cloning into c2 must be refused.
    await expect(authorizeAction('cloneCourseExtraData', { courseId: 'c1', newCourseId: 'c2' }, as('teacher1', 'teacher')))
      .rejects.toMatchObject(denied);
    await expect(authorizeAction('triggerScheduledEmailNow', { courseId: 'c1', emailId: 'e1' }, as('teacher1', 'teacher')))
      .resolves.toBeDefined();
  });

  test('course member actions accept roster, enrollment and staff members only', async () => {
    const payload = { courseId: 'c1' };
    await expect(authorizeAction('getCourseRoster', payload, as('student1', 'student'))).resolves.toBe(payload);
    await expect(authorizeAction('getCourseRoster', payload, as('student2', 'student'))).resolves.toBe(payload);
    await expect(authorizeAction('getCourseRoster', payload, as('teacher1', 'teacher'))).resolves.toBe(payload);
    await expect(authorizeAction('getCourseRoster', payload, as('outsider', 'student'))).rejects.toMatchObject(denied);
    await expect(authorizeAction('joinStudyGroup', { groupId: 'g1' }, as('outsider', 'student'))).rejects.toMatchObject(denied);
    await expect(authorizeAction('acknowledgeAnnouncement', { announcementId: 'n1' }, as('student1', 'student'))).resolves.toBeDefined();
  });

  test('missing course identifiers are reported as invalid arguments', async () => {
    await expect(authorizeAction('updateCourseName', {}, as('teacher1', 'teacher'))).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('scoped courseIds are filtered to accessible courses', async () => {
    const res = await authorizeAction('getStudentAssignments', { courseIds: ['c1', 'c2'] }, as('student1', 'student'));
    expect(res.courseIds).toEqual(['c1']);

    const teacherRes = await authorizeAction('getTeacherAssignments', { courseIds: ['c1', 'c2'] }, as('teacher1', 'teacher'));
    expect(teacherRes.courseIds).toEqual(['c1']);

    const adminRes = await authorizeAction('getStudentAssignments', { courseIds: ['c1', 'c2'] }, as('admin1', 'admin'));
    expect(adminRes.courseIds).toEqual(['c1', 'c2']);
  });
});
