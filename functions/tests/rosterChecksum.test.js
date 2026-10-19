const { rosterChecksum, shouldSyncRoster, saveRosterChecksum } = require('../src/lib/rosterChecksum');

function db() {
  const store = {};
  return {
    store,
    collection: () => ({ doc: (id) => ({
      get: async () => ({ exists: Boolean(store[id]), data: () => store[id] }),
      set: async (d) => { store[id] = { ...(store[id] || {}), ...d }; }
    }) })
  };
}

describe('roster checksums (mejora 3.37)', () => {
  it('is independent of order, case and spacing', () => {
    const a = rosterChecksum([{ id: 1, email: 'A@x.com' }, { id: 2, email: 'b@x.com' }], ['id', 'email']);
    const b = rosterChecksum([{ id: 2, email: ' b@x.com' }, { id: 1, email: 'a@x.com' }], ['id', 'email']);
    expect(a).toBe(b);
    expect(rosterChecksum([{ id: 3, email: 'c@x.com' }], ['id', 'email'])).not.toBe(a);
  });

  it('skips unchanged rosters unless forced', async () => {
    const d = db();
    const sum = rosterChecksum([{ legajo: '1' }], ['legajo']);
    expect(await shouldSyncRoster(d, 'c1', 'guarani', sum, false)).toBe(true);
    await saveRosterChecksum(d, 'c1', 'guarani', sum, 1);
    expect(await shouldSyncRoster(d, 'c1', 'guarani', sum, false)).toBe(false);
    expect(await shouldSyncRoster(d, 'c1', 'guarani', sum, true)).toBe(true);
    expect(await shouldSyncRoster(d, 'c1', 'moodle', sum, false)).toBe(true);
  });
});
