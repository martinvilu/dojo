// Stateful Firestore double for the autograding webhook.
const store = {};
const batches = [];

jest.mock('firebase-admin/firestore', () => {
  const docRef = (path) => ({
    id: path.split('/').pop(),
    path,
    get: async () => ({ exists: store[path] !== undefined, data: () => store[path] }),
    create: async (data) => {
      if (store[path] !== undefined) {
        const err = new Error('ALREADY_EXISTS');
        err.code = 6;
        throw err;
      }
      store[path] = data;
    },
    delete: async () => { delete store[path]; }
  });
  const query = (name, filters) => ({
    where: (field, op, value) => query(name, [...filters, [field, value]]),
    get: async () => {
      const docs = Object.entries(store)
        .filter(([path, data]) => path.split('/')[0] === name && filters.every(([f, v]) => data[f] === v))
        .map(([path, data]) => ({ id: path.split('/')[1], ref: docRef(path), data: () => data }));
      return { empty: docs.length === 0, docs };
    }
  });
  const db = {
    collection: (name) => ({ doc: (id) => docRef(`${name}/${id}`), where: (f, o, v) => query(name, [[f, v]]) }),
    batch: () => {
      const ops = [];
      const b = {
        update: (ref, data) => ops.push(() => { store[ref.path] = { ...store[ref.path], ...data }; }),
        set: (ref, data) => ops.push(() => { store[ref.path] = data; }),
        commit: jest.fn(async () => ops.forEach((op) => op()))
      };
      batches.push(b);
      return b;
    }
  };
  return { getFirestore: () => db, FieldValue: { serverTimestamp: () => 'TS' } };
});

const { webhook } = require('../src/modules/github/webhook');

const SECRET = 'A'.repeat(32);

function request(headers = {}) {
  return {
    method: 'POST',
    ip: '203.0.113.9',
    headers,
    body: { assignmentId: 'a1', sync_secret: SECRET, grades: [{ matricula: 'M1', grade: '8', feedback: 'ok' }] }
  };
}

function response() {
  return { set: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn(), json: jest.fn() };
}

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
  batches.length = 0;
  store['assignments/a1'] = { course_id: 'c1', sync_secret: SECRET };
  store['profiles/s1'] = { matricula_unrn: 'M1' };
});

describe('autograding webhook idempotency', () => {
  test('processes a delivery once and acknowledges retries as duplicates', async () => {
    const first = response();
    await webhook(request({ 'x-dojo-delivery': '123-1' }), first);
    expect(first.json).toHaveBeenCalledWith({ success: true, updatedCount: 1, rejected: [] });

    const retry = response();
    await webhook(request({ 'x-dojo-delivery': '123-1' }), retry);
    expect(retry.json).toHaveBeenCalledWith({ success: true, duplicate: true, updatedCount: 0, rejected: [] });
    expect(batches).toHaveLength(1);
    expect(store['processed_webhooks/a1_123-1']).toMatchObject({ delivery_id: '123-1' });
  });

  test('a new workflow attempt is a new delivery', async () => {
    await webhook(request({ 'x-dojo-delivery': '123-1' }), response());
    const rerun = response();
    await webhook(request({ 'x-dojo-delivery': '123-2' }), rerun);
    expect(rerun.json).toHaveBeenCalledWith({ success: true, updatedCount: 1, rejected: [] });
  });

  test('retries without delivery header reuse a deterministic submission id', async () => {
    await webhook(request(), response());
    await webhook(request(), response());
    const submissions = Object.keys(store).filter((k) => k.startsWith('submissions/'));
    expect(submissions).toEqual(['submissions/a1_s1']);
    expect(store['submissions/a1_s1']).toMatchObject({ grade: '8', student_id: 's1' });
  });

  test('releases the delivery marker when the batch fails so GitHub can retry', async () => {
    const res = response();
    const originalBatch = require('firebase-admin/firestore').getFirestore().batch;
    require('firebase-admin/firestore').getFirestore().batch = () => ({
      update: () => {}, set: () => {}, commit: async () => { throw new Error('boom'); }
    });
    await webhook(request({ 'x-dojo-delivery': '999-1' }), res);
    require('firebase-admin/firestore').getFirestore().batch = originalBatch;

    expect(res.status).toHaveBeenCalledWith(500);
    expect(store['processed_webhooks/a1_999-1']).toBeUndefined();
  });
});
