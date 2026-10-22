const { enforceRateLimit, limitFor } = require('../src/lib/rateLimit');

function fakeDb() {
  const store = new Map();
  return {
    store,
    collection: (name) => ({ doc: (id) => ({ path: `${name}/${id}` }) }),
    runTransaction: async (fn) => fn({
      get: async (ref) => ({ exists: store.has(ref.path), data: () => store.get(ref.path) }),
      set: (ref, data) => store.set(ref.path, data),
    }),
  };
}

describe('api rate limiting', () => {
  const now = 1_800_000_000_000;

  test('sensitive actions get their own stricter group', () => {
    expect(limitFor('submitQrAttendance')).toMatchObject({ group: 'qr', max: 10 });
    expect(limitFor('sendDirectStudentEmail').group).toBe('mail');
    expect(limitFor('getCourseDetails')).toMatchObject({ group: 'default', max: 120 });
  });

  test('rejects calls beyond the limit with resource-exhausted', async () => {
    const db = fakeDb();
    for (let i = 0; i < 10; i++) await enforceRateLimit(db, 'u1', 'submitQrAttendance', now);
    await expect(enforceRateLimit(db, 'u1', 'submitQrAttendance', now)).rejects.toMatchObject({ code: 'resource-exhausted' });
  });

  test('counts per user and per window, and sets a TTL', async () => {
    const db = fakeDb();
    for (let i = 0; i < 10; i++) await enforceRateLimit(db, 'u1', 'submitQrAttendance', now);
    await expect(enforceRateLimit(db, 'u2', 'submitQrAttendance', now)).resolves.toMatchObject({ count: 1 });
    await expect(enforceRateLimit(db, 'u1', 'submitQrAttendance', now + 60_000)).resolves.toMatchObject({ count: 1 });
    const [doc] = [...db.store.values()];
    expect(doc.expires_at).toBeInstanceOf(Date);
  });

  test('fails open when Firestore is unavailable', async () => {
    const db = { collection: () => ({ doc: () => ({}) }), runTransaction: async () => { throw new Error('unavailable'); } };
    await expect(enforceRateLimit(db, 'u1', 'getProfile', now)).resolves.toMatchObject({ allowed: true });
  });
});

describe('conditions group', () => {
  test('recomputing conditions has its own, larger budget than heavy jobs', () => {
    const { limitFor } = require('../src/lib/rateLimit');
    expect(limitFor('getAcademicConditions')).toMatchObject({ group: 'conditions', max: 60 });
    expect(limitFor('createSystemBackup')).toMatchObject({ group: 'heavy', max: 10 });
  });
});
