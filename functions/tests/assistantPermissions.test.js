const { authorizeAction } = require('../src/authz');
const { getCourseSettings } = require('../src/modules/course/courses');

function db(docs) {
  return {
    collection: (name) => ({
      doc: (id) => ({
        get: async () => ({ exists: Boolean(docs[`${name}/${id}`]), id, data: () => docs[`${name}/${id}`] }),
        update: async () => {}
      })
    })
  };
}
const DOCS = {
  'courses/c1': { name: 'Prog II', invite_code: 'AAA111', teacher_invite_code: 'T-XYZ', assistant_invite_code: 'A-XYZ', sync_secret: 'S', calendar_secret: 'C' },
  'course_teachers/c1_tit': { role: 'titular' },
  'course_teachers/c1_ayu': { role: 'ayudante' },
  'profiles/tit': { role: 'teacher' },
  'profiles/ayu': { role: 'teacher' },
  'assignments/a1': { course_id: 'c1' }
};

describe('assistant permissions (mejora 3.39)', () => {
  const as = (uid) => ({ uid, db: db(DOCS), profile: { role: 'teacher' } });

  it('lets assistants grade and run the class but not change the course structure', async () => {
    await expect(authorizeAction('getAssignmentSubmissions', { assignmentId: 'a1' }, as('ayu'))).resolves.toBeTruthy();
    await expect(authorizeAction('startQrAttendance', { courseId: 'c1' }, as('ayu'))).resolves.toBeTruthy();
    for (const [action, payload] of [
      ['updateCourseSettings', { courseId: 'c1' }],
      ['archiveAssignment', { assignmentId: 'a1' }],
      ['createAssignment', { courseId: 'c1' }],
      ['restoreScheduleVersion', { courseId: 'c1' }],
      ['syncMoodleCourseRoster', { courseId: 'c1' }]
    ]) {
      await expect(authorizeAction(action, payload, as('ayu'))).rejects.toMatchObject({ code: 'permission-denied', details: { code: 'ASSISTANT_NOT_ALLOWED' } });
      await expect(authorizeAction(action, payload, as('tit'))).resolves.toBeTruthy();
    }
  });

  it('hides the staff invite codes from assistants', async () => {
    const forAssistant = await getCourseSettings({ courseId: 'c1' }, { uid: 'ayu', db: db({ ...DOCS }) });
    expect(forAssistant.teacher_invite_code).toBeUndefined();
    expect(forAssistant.assistant_invite_code).toBeUndefined();
    expect(forAssistant.course_role).toBe('ayudante');
    const forTitular = await getCourseSettings({ courseId: 'c1' }, { uid: 'tit', db: db({ ...DOCS }) });
    expect(forTitular.teacher_invite_code).toBe('T-XYZ');
  });
});
