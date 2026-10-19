const { exportMyData, requestAccountDeletion, cancelAccountDeletion } = require('../src/modules/auth/privacy');

function memDb(initial) {
  const store = new Map(Object.entries(initial));
  const matches = (d, [f, op, v]) => (op === '==' ? d[f] === v : op === 'array-contains' ? (d[f] || []).includes(v) : false);
  const coll = (prefix, filters = []) => ({
    where: (f, op, v) => coll(prefix, [...filters, [f, op, v]]),
    get: async () => {
      const keys = [...store.keys()].filter((k) => k.startsWith(`${prefix}/`) && k.split('/').length === prefix.split('/').length + 1 && filters.every((fl) => matches(store.get(k), fl)));
      return { docs: keys.map((k) => ({ id: k.split('/').pop(), data: () => store.get(k) })) };
    },
    doc: (id) => ({
      get: async () => ({ exists: store.has(`${prefix}/${id}`), data: () => store.get(`${prefix}/${id}`) }),
      update: async (d) => {
        const next = { ...store.get(`${prefix}/${id}`) };
        for (const [k, v] of Object.entries(d)) { if (v && v.__delete) delete next[k]; else next[k] = v; }
        store.set(`${prefix}/${id}`, next);
      },
      collection: (name) => coll(`${prefix}/${id}/${name}`)
    })
  });
  return { store, collection: (name) => coll(name) };
}

const DATA = {
  'profiles/u1': { full_name: 'Ana', email: 'ana@unrn.edu.ar', role: 'student', last_auth_time: 9, created_at: new Date('2026-03-01T00:00:00Z') },
  'profiles/u1/xp_logs/x1': { points: 10 },
  'profiles/u1/security_log/9': { ip: '1.2.3.4' },
  'course_roster/c1_u1': { course_id: 'c1', student_id: 'u1' },
  'submissions/s1': { student_id: 'u1', assignment_id: 'a1', grade: '9' },
  'submissions/s2': { student_id: 'u2', assignment_id: 'a1', grade: '4' },
  'courses/c1/attendance/class_1': { records: { u1: 'present', u2: 'absent' } },
  'courses/c1/attendance/class_2': { records: { u2: 'present' } },
  'courses/c1/class_comments/m1': { user_id: 'u1', content: 'Mi duda' },
  'courses/c1/class_comments/m2': { user_id: 'u2', content: 'Otra' },
  'study_groups/g1': { name: 'Recursantes', members: ['u1', 'u2', 'u3'] },
  'peer_reviews/r1': { reviewer_id: 'u1', reviewee_id: 'u2' },
  'notifications/n1': { student_id: 'u1', message: 'Corregida' }
};

describe('exportMyData (mejora 3.49)', () => {
  it('exports the user data and nothing from other students', async () => {
    const out = await exportMyData({}, { uid: 'u1', db: memDb({ ...DATA }) });
    expect(out.profile).toMatchObject({ full_name: 'Ana', created_at: '2026-03-01T00:00:00.000Z' });
    expect(out.profile.last_auth_time).toBeUndefined();
    expect(out.submissions.map((s) => s.id)).toEqual(['s1']);
    expect(out.attendance).toEqual([{ course_id: 'c1', class: 'class_1', status: 'present' }]);
    expect(out.forum_messages.map((m) => m.content)).toEqual(['Mi duda']);
    expect(out.study_groups).toEqual([{ id: 'g1', name: 'Recursantes', members_count: 3 }]);
    expect(out.peer_reviews_written).toHaveLength(1);
    expect(out.xp_logs).toHaveLength(1);
    expect(out.security_log).toHaveLength(1);
    expect(JSON.stringify(out)).not.toContain('Otra');
  });

  it('records and cancels account deletion requests', async () => {
    const db = memDb({ ...DATA });
    await requestAccountDeletion({ reason: '  Me cambio de carrera ' }, { uid: 'u1', db });
    expect(db.store.get('profiles/u1')).toMatchObject({ deletion_reason: 'Me cambio de carrera' });
    expect(db.store.get('profiles/u1').deletion_requested_at).toBeInstanceOf(Date);
    await cancelAccountDeletion({}, { uid: 'u1', db, admin: { firestore: { FieldValue: { delete: () => ({ __delete: true }) } } } });
    expect(db.store.get('profiles/u1').deletion_requested_at).toBeUndefined();
  });
});
