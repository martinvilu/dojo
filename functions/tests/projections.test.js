const { publicProfile, staffStudentProfile } = require('../src/lib/projections');
const { getCourseTeachers, getCourseRoster } = require('../src/modules/course/courses');

const FULL = {
  full_name: 'Naruto', email: 'n@x', role: 'student', github_user: 'naruto', avatar_url: 'a.png',
  matricula_unrn: 'UNRN-12345', cohorte: '2026', commissions: { c1: 'A' }, account_status: 'approved',
  secondary_emails: ['otro@x'], xp_total: 30, internal_flag: true
};

function dbWith(docs, queryDocs) {
  return {
    collection: (name) => ({
      doc: (id) => ({ get: async () => ({ exists: Boolean(docs[`${name}/${id}`]), id, data: () => docs[`${name}/${id}`] }) }),
      where: () => ({ get: async () => ({ docs: (queryDocs[name] || []).map((d) => ({ data: () => d })) }) })
    })
  };
}

describe('profile projections', () => {
  it('public profile keeps only identity fields', () => {
    expect(publicProfile(FULL)).toEqual({ full_name: 'Naruto', email: 'n@x', role: 'student', github_user: 'naruto', avatar_url: 'a.png' });
    expect(publicProfile(null)).toBeNull();
  });

  it('staff view adds academic fields but no secondary emails or internals', () => {
    const p = staffStudentProfile(FULL);
    expect(p).toMatchObject({ matricula_unrn: 'UNRN-12345', commissions: { c1: 'A' }, xp_total: 30 });
    expect(p.secondary_emails).toBeUndefined();
    expect(p.internal_flag).toBeUndefined();
  });

  it('getCourseTeachers returns public teacher profiles to course members', async () => {
    const db = dbWith({ 'profiles/t1': { ...FULL, role: 'teacher' } }, { course_teachers: [{ course_id: 'c1', teacher_id: 't1', role: 'titular' }] });
    const [t] = await getCourseTeachers({ courseId: 'c1' }, { db });
    expect(t.profiles.matricula_unrn).toBeUndefined();
    expect(t.profiles.full_name).toBe('Naruto');
  });

  it('getCourseRoster projects per viewer', async () => {
    const docs = { 'profiles/s1': FULL, 'course_teachers/c1_t1': { role: 'titular' } };
    const db = dbWith(docs, { course_roster: [{ course_id: 'c1', student_id: 's1', status: 'approved' }] });
    const [asStaff] = await getCourseRoster({ courseId: 'c1' }, { db, uid: 't1', getMyProfile: async () => ({ role: 'teacher' }) });
    expect(asStaff.matricula_unrn).toBe('UNRN-12345');
    expect(asStaff.secondary_emails).toBeUndefined();
    const [asPeer] = await getCourseRoster({ courseId: 'c1' }, { db, uid: 's2', getMyProfile: async () => ({ role: 'student' }) });
    expect(asPeer.matricula_unrn).toBeUndefined();
    expect(asPeer.full_name).toBe('Naruto');
  });
});

describe('setStudentCommission', () => {
  const { setStudentCommission } = require('../src/modules/course/courses');
  const dbFor = (docs) => {
    const updates = [];
    return {
      updates,
      collection: (name) => ({
        doc: (id) => ({
          get: async () => ({ exists: Boolean(docs[`${name}/${id}`]) }),
          update: async (d) => updates.push([`${name}/${id}`, d])
        })
      })
    };
  };

  it('sets the commission of an enrolled student for that course only', async () => {
    const db = dbFor({ 'course_roster/c1_s1': {} });
    await expect(setStudentCommission({ courseId: 'c1', studentId: 's1', commission: ' Comisión A ' }, { db })).resolves.toEqual({ success: true, commission: 'Comisión A' });
    expect(db.updates).toEqual([['profiles/s1', { 'commissions.c1': 'Comisión A' }]]);
  });

  it('rejects students outside the course and oversized names', async () => {
    const db = dbFor({ 'course_roster/c1_s1': {} });
    await expect(setStudentCommission({ courseId: 'c1', studentId: 's9', commission: 'A' }, { db })).rejects.toMatchObject({ code: 'NOT_COURSE_MEMBER' });
    await expect(setStudentCommission({ courseId: 'c1', studentId: 's1', commission: 'x'.repeat(61) }, { db })).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
  });
});
