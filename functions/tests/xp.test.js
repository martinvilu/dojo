const { awardXp, sanitizeKey } = require('../src/lib/xp');

function fakeDb() {
  const store = new Map();
  const ref = (path) => ({
    path,
    collection: (name) => ({ doc: (id) => ref(`${path}/${name}/${id}`) })
  });
  let queue = Promise.resolve();
  return {
    store,
    collection: (name) => ({ doc: (id) => ref(`${name}/${id}`) }),
    // Serializa las transacciones como lo haría Firestore ante conflicto.
    runTransaction: (fn) => {
      const run = queue.then(() => fn({
        get: async (r) => ({ exists: store.has(r.path) }),
        set: (r, data, opts) => {
          const prev = store.get(r.path) || {};
          if (opts && opts.merge && data.xp_total && data.xp_total.__increment) {
            store.set(r.path, { ...prev, xp_total: (prev.xp_total || 0) + data.xp_total.__increment });
          } else {
            store.set(r.path, data);
          }
        }
      }));
      queue = run.catch(() => {});
      return run;
    }
  };
}

const FieldValue = { serverTimestamp: () => 'TS', increment: (n) => ({ __increment: n }) };

describe('awardXp', () => {
  it('awards once per key even under concurrent calls', async () => {
    const db = fakeDb();
    const event = { key: 'attendance_c1_3', action: 'asistencia', description: 'x', points: 10 };
    const results = await Promise.all([awardXp(db, FieldValue, 'u1', event), awardXp(db, FieldValue, 'u1', event)]);
    expect(results.sort()).toEqual([false, true]);
    expect(db.store.get('profiles/u1').xp_total).toBe(10);
    expect(db.store.get('profiles/u1/xp_logs/attendance_c1_3')).toMatchObject({ points: 10, timestamp: 'TS' });
  });

  it('accumulates different events atomically', async () => {
    const db = fakeDb();
    await Promise.all([1, 2, 3].map((n) => awardXp(db, FieldValue, 'u1', { key: `k${n}`, action: 'a', description: 'd', points: n * 10 })));
    expect(db.store.get('profiles/u1').xp_total).toBe(60);
  });

  it('sanitizes keys into valid document ids', () => {
    expect(sanitizeKey('attendance/c1 #3')).toBe('attendance_c1__3');
  });
});
