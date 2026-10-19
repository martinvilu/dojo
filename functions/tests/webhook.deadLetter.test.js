let mockDb;
jest.mock('firebase-admin/firestore', () => ({
  getFirestore: () => mockDb,
  FieldValue: { serverTimestamp: () => 'TS' }
}));
const { webhook, retryDeadLetters, nextAttemptAt, MAX_ATTEMPTS_DLQ } = require('../src/modules/github/webhook');

function makeDb({ failCommits = 0 } = {}) {
  const store = new Map([
    ['assignments/a1', { sync_secret: 'SECRET', course_id: 'c1' }],
    ['profiles/s1', { matricula_unrn: 'UNRN-11111' }]
  ]);
  let commitFailures = failCommits;
  const matches = (d, [f, op, v]) => (op === '==' ? d[f] === v : op === '<=' ? d[f] <= v : true);
  const ref = (path) => ({
    path,
    get: async () => ({ exists: store.has(path), data: () => store.get(path) }),
    create: async (d) => { if (store.has(path)) { const e = new Error('exists'); e.code = 6; throw e; } store.set(path, d); },
    update: async (d) => store.set(path, { ...store.get(path), ...d }),
    delete: async () => store.delete(path)
  });
  const coll = (name, filters = [], max = Infinity) => ({
    doc: (id) => ref(`${name}/${id}`),
    where: (f, op, v) => coll(name, [...filters, [f, op, v]], max),
    limit: (n) => coll(name, filters, n),
    add: async (d) => { const id = `dl${store.size}`; store.set(`${name}/${id}`, d); return { id }; },
    get: async () => {
      const docs = [...store.keys()].filter((k) => k.split('/')[0] === name && filters.every((fl) => matches(store.get(k), fl))).slice(0, max)
        .map((k) => ({ id: k.split('/')[1], data: () => store.get(k), ref: ref(k) }));
      return { empty: docs.length === 0, docs };
    }
  });
  return {
    store,
    collection: (name) => coll(name),
    batch: () => {
      const ops = [];
      return {
        update: (r, d) => ops.push(() => r.update(d)),
        set: (r, d) => ops.push(() => store.set(r.path, d)),
        commit: async () => {
          if (commitFailures > 0) { commitFailures--; throw new Error('DEADLINE_EXCEEDED'); }
          for (const op of ops) await op();
        }
      };
    }
  };
}

function call(body) {
  const res = { statusCode: 200, body: null, set() {}, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; }, send(b) { this.body = b; return this; } };
  return webhook({ method: 'POST', ip: '1.1.1.1', headers: { 'x-dojo-delivery': 'run-42' }, body }, res).then(() => res);
}

const BODY = { assignmentId: 'a1', sync_secret: 'SECRET', grades: [{ matricula: 'UNRN-11111', grade: '8' }] };

describe('autograding dead letter queue (mejora 3.38)', () => {
  it('queues the event with 202 when the write fails, then retries it', async () => {
    mockDb = makeDb({ failCommits: 1 });
    const res = await call(BODY);
    expect(res.statusCode).toBe(202);
    expect(res.body).toMatchObject({ queued: true });
    const letter = mockDb.store.get(`webhook_dead_letters/${res.body.retryId}`);
    expect(letter).toMatchObject({ status: 'pending', attempts: 0, assignment_id: 'a1', last_error: 'DEADLINE_EXCEEDED' });
    expect(JSON.stringify(letter)).not.toContain('SECRET');

    // Un reintento del cliente con la misma entrega no la duplica.
    expect((await call(BODY)).body).toMatchObject({ duplicate: true });

    const summary = await retryDeadLetters(mockDb, new Date(Date.now() + 10 * 60 * 1000));
    expect(summary).toEqual({ done: 1, retried: 0, failed: 0 });
    expect(mockDb.store.get('submissions/a1_s1')).toMatchObject({ grade: '8', grade_source: 'autograding' });
  });

  it('backs off exponentially and gives up after the last attempt', async () => {
    mockDb = makeDb({ failCommits: 100 });
    mockDb.store.set('webhook_dead_letters/x', { status: 'pending', attempts: MAX_ATTEMPTS_DLQ - 2, assignment_id: 'a1', grades: BODY.grades, next_attempt_at: new Date(0) });
    const t0 = new Date(1_000_000);
    expect(await retryDeadLetters(mockDb, t0)).toEqual({ done: 0, retried: 1, failed: 0 });
    const after = mockDb.store.get('webhook_dead_letters/x');
    expect(after.next_attempt_at).toEqual(nextAttemptAt(MAX_ATTEMPTS_DLQ - 1, t0.getTime()));
    expect(await retryDeadLetters(mockDb, after.next_attempt_at)).toEqual({ done: 0, retried: 0, failed: 1 });
    expect(mockDb.store.get('webhook_dead_letters/x').status).toBe('failed');
  });
});
