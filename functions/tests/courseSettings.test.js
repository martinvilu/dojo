const { getCourseSettings, getCourseDetails, updateCourseSettings, sanitizeCourseSettings } = require('../src/modules/course/courses');

function db(docs) {
  const updates = [];
  return {
    updates,
    collection: (name) => ({
      doc: (id) => ({
        get: async () => ({ exists: Boolean(docs[`${name}/${id}`]), id, data: () => docs[`${name}/${id}`] }),
        update: async (d) => { updates.push([`${name}/${id}`, d]); docs[`${name}/${id}`] = { ...docs[`${name}/${id}`], ...d }; }
      }),
      where: () => ({ where: () => ({ get: async () => ({ empty: true, docs: [] }) }), get: async () => ({ empty: true, docs: [] }) }),
      add: async () => ({ id: 'v1' })
    })
  };
}
const admin = { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } };
const COURSE = { name: 'Prog II', github_token: 'ghp_secret', sync_secret: 'S', calendar_secret: 'C', invite_code: 'AAA111', teacher_invite_code: 'T-1', assistant_invite_code: 'A-1' };

describe('course credentials never leave the backend', () => {
  it('getCourseSettings and getCourseDetails omit the GitHub token', async () => {
    const docs = { 'courses/c1': { ...COURSE }, 'profiles/t1': { role: 'teacher' }, 'course_teachers/c1_t1': { role: 'titular' } };
    const ctx = { db: db(docs), uid: 't1', getMyProfile: async () => ({ role: 'teacher' }) };
    const settings = await getCourseSettings({ courseId: 'c1' }, ctx);
    expect(settings.github_token).toBeUndefined();
    expect(settings.has_github_token).toBe(true);
    const details = await getCourseDetails({ courseId: 'c1' }, ctx);
    expect(details.github_token).toBeUndefined();
    expect(details.has_github_token).toBe(true);
  });
});

describe('updateCourseSettings whitelist', () => {
  it('keeps the stored token when the field is empty and rejects non-editable fields', async () => {
    const docs = { 'courses/c1': { ...COURSE }, 'profiles/t1': { role: 'teacher' }, 'course_teachers/c1_t1': { role: 'titular' } };
    const ctx = { db: db(docs), uid: 't1', admin };
    await updateCourseSettings({ courseId: 'c1', data: { cover_text: 'Hola', github_token: '' } }, ctx);
    expect(docs['courses/c1'].github_token).toBe('ghp_secret');
    expect(docs['courses/c1'].cover_text).toBe('Hola');
    await expect(updateCourseSettings({ courseId: 'c1', data: { sync_secret: 'mine' } }, ctx)).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    await expect(updateCourseSettings({ courseId: 'c1', data: { deleted_at: null } }, ctx)).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    await updateCourseSettings({ courseId: 'c1', data: { github_token: ' ghp_new ' } }, ctx);
    expect(docs['courses/c1'].github_token).toBe('ghp_new');
  });

  it('validates value types', () => {
    expect(() => sanitizeCourseSettings({ duration_weeks: 'diez' })).toThrow(/duration_weeks/);
    expect(() => sanitizeCourseSettings({ external_calendars: ['http://inseguro'] })).toThrow(/external_calendars/);
    expect(() => sanitizeCourseSettings('x')).toThrow();
    expect(sanitizeCourseSettings({ duration_weeks: null, start_date: '2026-03-01', moodle_enabled: true })).toEqual({ duration_weeks: null, start_date: '2026-03-01', moodle_enabled: true });
  });
});
