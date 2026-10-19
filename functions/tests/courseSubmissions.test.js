const { getCourseSubmissions } = require('../src/modules/github/courseSubmissions');

function db(docs) {
  const queries = [];
  const coll = (name, filters = []) => ({
    where: (f, op, v) => coll(name, [...filters, [f, op, v]]),
    doc: (id) => ({ id, get: async () => ({ exists: Boolean(docs[`${name}/${id}`]), data: () => docs[`${name}/${id}`] }) }),
    get: async () => {
      queries.push({ name, filters });
      const rows = Object.entries(docs)
        .filter(([k]) => k.startsWith(`${name}/`))
        .filter(([, d]) => filters.every(([f, op, v]) => (op === 'in' ? v.includes(d[f]) : d[f] === v)));
      return { docs: rows.map(([k, d]) => ({ id: k.split('/')[1], data: () => d })) };
    }
  });
  const getAll = jest.fn(async (...refs) => Promise.all(refs.map((r) => r.get())));
  return { queries, getAll, collection: (n) => coll(n) };
}

const DOCS = {
  'profiles/s1': { full_name: 'Ana', matricula_unrn: 'UNRN-1', secondary_emails: ['x'] },
  'profiles/s2': { full_name: 'Beto' }
};
for (let i = 0; i < 35; i++) DOCS[`assignments/a${i}`] = { course_id: 'c1', title: `TP ${i}` };
DOCS['assignments/otro'] = { course_id: 'c2', title: 'Ajena' };
DOCS['submissions/x1'] = { assignment_id: 'a0', student_id: 's1', status: 'submitted', grade: '' };
DOCS['submissions/x2'] = { assignment_id: 'a34', student_id: 's2', status: 'submitted', grade: '9' };
DOCS['submissions/x3'] = { assignment_id: 'a5', student_id: 's1', status: 'accepted' };
DOCS['submissions/x4'] = { assignment_id: 'otro', student_id: 's2', status: 'submitted' };

describe('getCourseSubmissions (mejora 3.23)', () => {
  it('returns every submission of the course in batched queries with one profile fetch', async () => {
    const d = db({ ...DOCS });
    const all = await getCourseSubmissions({ courseId: 'c1' }, { db: d });
    expect(all.map((s) => s.id).sort()).toEqual(['x1', 'x2', 'x3']);
    expect(d.queries.filter((q) => q.name === 'submissions')).toHaveLength(2); // 35 tareas -> 2 lotes
    expect(d.getAll).toHaveBeenCalledTimes(1);
    const x1 = all.find((s) => s.id === 'x1');
    expect(x1).toMatchObject({ assignmentTitle: 'TP 0', assignmentId: 'a0', profiles: { full_name: 'Ana' } });
    expect(x1.profiles.secondary_emails).toBeUndefined();
  });

  it('filters the grading queue on the server', async () => {
    const d = db({ ...DOCS });
    const pending = await getCourseSubmissions({ courseId: 'c1', pendingOnly: true }, { db: d });
    expect(pending.map((s) => s.id)).toEqual(['x1']);
    expect(d.queries.find((q) => q.name === 'submissions').filters).toContainEqual(['status', '==', 'submitted']);
  });
});
