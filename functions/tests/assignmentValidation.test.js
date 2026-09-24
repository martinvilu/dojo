global.fetch = jest.fn();
const { createAssignment, updateAssignment } = require('../src/modules/github/assignments');
const { cloneCourseExtraData } = require('../src/modules/course/courses');

function createContext(docs = {}) {
  const store = {
    'courses/c1': { start_date: '2026-03-01' },
    'assignments/a1': { course_id: 'c1', title: 'TP1', sync_secret: 'OLD' },
    ...docs
  };
  const added = [];
  const updated = [];
  const db = {
    collection: (name) => ({
      doc: (id) => ({
        get: async () => ({ exists: store[`${name}/${id}`] !== undefined, data: () => store[`${name}/${id}`] }),
        update: async (data) => updated.push({ path: `${name}/${id}`, data })
      }),
      add: async (data) => { added.push({ collection: name, data }); return { id: 'new' }; },
      where: () => ({
        get: async () => ({
          docs: Object.entries(store)
            .filter(([path, data]) => path.startsWith(`${name}/`) && data.course_id === 'c1')
            .map(([path, data]) => ({ id: path.split('/')[1], data: () => ({ ...data }) }))
        })
      })
    })
  };
  return { db, added, updated, admin: { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } } };
}

const invalidArgument = { code: 'invalid-argument' };

describe('assignment validation', () => {
  test('normalizes GitHub URLs to org/repo and fills defaults', async () => {
    const ctx = createContext();
    await createAssignment({ courseId: 'c1', title: '  TP 2  ', template_repo: 'https://github.com/unrn-prog/tp2-plantilla.git' }, ctx);
    expect(ctx.added[0].data).toMatchObject({
      course_id: 'c1', title: 'TP 2', template_repo: 'unrn-prog/tp2-plantilla',
      is_group: false, create_feedback_pr: false, due_date: '', description: ''
    });
  });

  test.each([
    [{ title: '' }, 'título'],
    [{ title: 'x'.repeat(121) }, '120'],
    [{ title: 'TP', template_repo: 'no-es-un-repo' }, 'organizacion/repositorio'],
    [{ title: 'TP', template_repo: 'org/repo/extra' }, 'organizacion/repositorio'],
    [{ title: 'TP', due_date: 'mañana' }, 'no es válida'],
    [{ title: 'TP', due_date: '2026-02-15' }, 'anterior al inicio']
  ])('rejects %p', async (payload, message) => {
    const ctx = createContext();
    const promise = createAssignment({ courseId: 'c1', ...payload }, ctx);
    await expect(promise).rejects.toMatchObject(invalidArgument);
    await expect(promise).rejects.toThrow(message);
    expect(ctx.added).toHaveLength(0);
  });

  test('accepts a due date on or after the course start', async () => {
    const ctx = createContext();
    await createAssignment({ courseId: 'c1', title: 'TP', due_date: '2026-03-01' }, ctx);
    expect(ctx.added[0].data.due_date).toBe('2026-03-01');
  });

  test('updateAssignment only writes editable fields', async () => {
    const ctx = createContext();
    await updateAssignment({ assignmentId: 'a1', data: { title: 'TP1 v2', course_id: 'c2', sync_secret: 'x', peer_review: { enabled: true } } }, ctx);
    expect(ctx.updated).toEqual([{ path: 'assignments/a1', data: { title: 'TP1 v2' } }]);
  });

  test('updateAssignment rejects payloads without editable changes', async () => {
    const ctx = createContext();
    await expect(updateAssignment({ assignmentId: 'a1', data: { course_id: 'c2' } }, ctx)).rejects.toMatchObject(invalidArgument);
  });

  test('cloned assignments get a fresh autograding secret', async () => {
    const ctx = createContext({ 'courses/c2': {} });
    await cloneCourseExtraData({ courseId: 'c1', newCourseId: 'c2' }, ctx);
    const clone = ctx.added.find((a) => a.collection === 'assignments').data;
    expect(clone.course_id).toBe('c2');
    expect(clone.sync_secret).toMatch(/^[0-9A-F]{32}$/);
  });
});
