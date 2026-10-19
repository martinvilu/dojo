const {
  GLOBAL_POLICY,
  ACTION_POLICIES,
  consumeWindow,
  enforceRateLimit,
  resetMemoryRateLimits
} = require('../src/lib/rateLimit');

function fakeDb() {
  const store = new Map();
  return {
    store,
    collection: (name) => ({
      doc: (id) => ({ path: `${name}/${id}` })
    }),
    runTransaction: async (fn) => fn({
      get: async (ref) => ({ exists: store.has(ref.path), data: () => store.get(ref.path) }),
      set: (ref, data) => store.set(ref.path, data)
    })
  };
}

describe('consumeWindow', () => {
  const policy = { limit: 2, windowMs: 1000 };

  it('opens a new window when there is no previous state', () => {
    expect(consumeWindow(null, policy, 5000)).toEqual({ allowed: true, state: { window_start: 5000, count: 1 }, retryAfterMs: 0 });
  });

  it('blocks once the limit is reached and reports the remaining time', () => {
    const r = consumeWindow({ window_start: 5000, count: 2 }, policy, 5400);
    expect(r.allowed).toBe(false);
    expect(r.retryAfterMs).toBe(600);
  });

  it('resets the counter when the window elapsed', () => {
    expect(consumeWindow({ window_start: 5000, count: 2 }, policy, 6000).state).toEqual({ window_start: 6000, count: 1 });
  });
});

describe('enforceRateLimit', () => {
  beforeEach(() => resetMemoryRateLimits());

  it('applies the global per-user limit in memory', async () => {
    const now = 1_000_000;
    for (let i = 0; i < GLOBAL_POLICY.limit; i++) {
      await enforceRateLimit('getProfile', 'u1', { now });
    }
    await expect(enforceRateLimit('getProfile', 'u1', { now })).rejects.toMatchObject({ code: 'resource-exhausted' });
    // Otro usuario no se ve afectado.
    await expect(enforceRateLimit('getProfile', 'u2', { now })).resolves.toBeUndefined();
  });

  it('persists sensitive action counters with a TTL', async () => {
    const db = fakeDb();
    const now = 2_000_000;
    const { limit, windowMs } = ACTION_POLICIES.submitMatricula;
    for (let i = 0; i < limit; i++) {
      await enforceRateLimit('submitMatricula', 'u1', { db, now: now + i });
    }
    const err = await enforceRateLimit('submitMatricula', 'u1', { db, now: now + limit }).catch((e) => e);
    expect(err.code).toBe('resource-exhausted');
    expect(err.details).toMatchObject({ code: 'RATE_LIMITED' });
    const doc = db.store.get('rate_limits/u1__submitMatricula');
    expect(doc.count).toBe(limit);
    expect(doc.expires_at).toEqual(new Date(now + windowMs));
    // Pasada la ventana vuelve a permitir.
    await expect(enforceRateLimit('submitMatricula', 'u1', { db, now: now + windowMs })).resolves.toBeUndefined();
  });

  it('falls back to memory when the store fails', async () => {
    const warn = jest.fn();
    const db = { runTransaction: jest.fn().mockRejectedValue(new Error('unavailable')), collection: () => ({ doc: () => ({}) }) };
    await expect(enforceRateLimit('enrollCourse', 'u3', { db, logger: { warn }, now: 1 })).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });
});
