const { assertActiveEnrollment } = require('../src/lib/enrollmentStatus');
const { submitAssignment } = require('../src/modules/github/assignments');

const db = (docs) => ({
  collection: (n) => ({ doc: (id) => ({
    get: async () => ({ exists: Boolean(docs[`${n}/${id}`]), data: () => docs[`${n}/${id}`] }),
    ref: null
  }) })
});

describe('enrollment status before submissions (mejora 3.48)', () => {
  it('blocks students marked as observers by the official roster', async () => {
    await expect(assertActiveEnrollment(db({ 'course_roster/c1_u1': { status: 'observador' } }), 'c1', 'u1')).rejects.toMatchObject({ code: 'ENROLLMENT_INACTIVE' });
    await expect(assertActiveEnrollment(db({ 'enrollments/u1_c1': { status: 'dropped' } }), 'c1', 'u1')).rejects.toMatchObject({ code: 'ENROLLMENT_INACTIVE' });
  });

  it('lets active, approved and pending students through', async () => {
    for (const status of ['approved', 'active', 'pending']) {
      await expect(assertActiveEnrollment(db({ 'course_roster/c1_u1': { status } }), 'c1', 'u1')).resolves.toBeUndefined();
    }
    await expect(assertActiveEnrollment(db({}), 'c1', 'u1')).resolves.toBeUndefined();
  });

  it('submitAssignment checks the status of the submission course', async () => {
    const docs = {
      'submissions/s1': { student_id: 'u1', assignment_id: 'a1' },
      'assignments/a1': { course_id: 'c1' },
      'course_roster/c1_u1': { status: 'observador' }
    };
    const ctxDb = {
      collection: (n) => ({ doc: (id) => ({
        get: async () => ({ exists: Boolean(docs[`${n}/${id}`]), data: () => docs[`${n}/${id}`], ref: { update: jest.fn() } })
      }) })
    };
    await expect(submitAssignment({ submissionId: 's1' }, { uid: 'u1', db: ctxDb, admin: { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } } }))
      .rejects.toMatchObject({ code: 'ENROLLMENT_INACTIVE' });
  });
});
