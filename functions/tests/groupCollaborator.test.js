global.fetch = jest.fn();
const { addGroupCollaborator } = require('../src/modules/github/assignments');

function createContext(uid, extraDocs = {}) {
  const docs = {
    'submissions/s1': { assignment_id: 'a1', student_id: 'owner', repo_url: 'https://github.com/org/tp1-owner' },
    'assignments/a1': { course_id: 'c1' },
    'assignments/a2': { course_id: 'c2' },
    'courses/c1': { github_token: 'token-c1' },
    'course_roster/c1_mate': { course_id: 'c1', student_id: 'mate' },
    'course_teachers/c1_teacher': { course_id: 'c1', teacher_id: 'teacher' },
    'profiles/mate': { email: 'mate@unrn.edu.ar', github_user: 'mate-gh' },
    'profiles/stranger': { email: 'stranger@unrn.edu.ar', github_user: 'stranger-gh' },
    ...extraDocs
  };
  const writes = [];
  const db = {
    collection: (name) => ({
      doc: (id) => ({
        get: async () => ({ exists: docs[`${name}/${id}`] !== undefined, data: () => docs[`${name}/${id}`] }),
        set: async (data) => writes.push({ path: `${name}/${id}`, data })
      }),
      where: (field, op, value) => ({
        get: async () => {
          const found = Object.entries(docs)
            .filter(([path, data]) => path.startsWith(`${name}/`) && data[field] === value)
            .map(([path, data]) => ({ id: path.split('/')[1], data: () => data }));
          return { empty: found.length === 0, docs: found };
        }
      })
    })
  };
  const admin = { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } };
  return { uid, db, admin, writes };
}

describe('addGroupCollaborator', () => {
  beforeEach(() => {
    fetch.mockReset();
    fetch.mockResolvedValue({ ok: true, json: async () => ({}) });
  });

  test('lets the submission owner add an enrolled classmate', async () => {
    const ctx = createContext('owner');
    await addGroupCollaborator({ submissionId: 's1', email: 'mate@unrn.edu.ar' }, ctx);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/org/tp1-owner/collaborators/mate-gh',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'token token-c1' }) })
    );
    expect(ctx.writes[0]).toMatchObject({ path: 'submissions/a1_mate', data: { assignment_id: 'a1' } });
  });

  test('rejects other students of the course', async () => {
    await expect(addGroupCollaborator({ submissionId: 's1', email: 'mate@unrn.edu.ar' }, createContext('mate')))
      .rejects.toThrow('Solo el autor');
    expect(fetch).not.toHaveBeenCalled();
  });

  test('rejects an assignmentId that does not match the submission', async () => {
    await expect(addGroupCollaborator({ submissionId: 's1', assignmentId: 'a2', email: 'mate@unrn.edu.ar' }, createContext('owner')))
      .rejects.toThrow('no pertenece');
  });

  test('rejects collaborators that are not enrolled in the course', async () => {
    await expect(addGroupCollaborator({ submissionId: 's1', email: 'stranger@unrn.edu.ar' }, createContext('teacher')))
      .rejects.toThrow('no está inscripto');
    expect(fetch).not.toHaveBeenCalled();
  });
});
