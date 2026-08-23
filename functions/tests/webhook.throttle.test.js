const test = require('firebase-functions-test')();

// Modules import Firestore helpers from the 'firebase-admin/firestore'
// subpath; delegate them to the mocked 'firebase-admin' main entry so both
// share the same fakes.
jest.mock('firebase-admin/firestore', () => ({
  getFirestore: () => require('firebase-admin').firestore(),
  FieldValue: { serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP') }
}));

jest.mock('firebase-admin', () => {
  const getMock = jest.fn();
  const docMock = jest.fn();
  const collectionMock = jest.fn();
  const batchMock = jest.fn();

  const fakeCollection = {
    doc: docMock,
    where: jest.fn().mockReturnThis(),
    get: getMock,
    add: jest.fn().mockResolvedValue({ id: 'new_id' })
  };
  const fakeDoc = { get: getMock };
  collectionMock.mockReturnValue(fakeCollection);
  docMock.mockReturnValue(fakeDoc);

  const fakeBatch = {
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn().mockResolvedValue({})
  };
  batchMock.mockReturnValue(fakeBatch);

  return {
    initializeApp: jest.fn(),
    firestore: Object.assign(() => ({
      collection: collectionMock,
      batch: batchMock,
      settings: jest.fn()
    }), {
      FieldValue: { serverTimestamp: jest.fn() }
    }),
    auth: () => ({
      verifyIdToken: jest.fn()
    })
  };
});

admin = require('firebase-admin');
const myFunctions = require('../index.js');

// Keep in sync with ATTEMPT_WINDOW_MS / MAX_ATTEMPTS in webhook.js
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 5 * 60 * 1000;

const SECRET = 'A'.repeat(32);

function makeRes() {
  return {
    set: jest.fn(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
    json: jest.fn()
  };
}

function makeReq(ip, overrides = {}) {
  return {
    method: 'POST',
    ip,
    body: { assignmentId: 'a1', sync_secret: 'wrong_secret', grades: [{ matricula: 'M1', grade: '7' }] },
    ...overrides
  };
}

function stubAssignmentFound() {
  const db = admin.firestore();
  db.collection().doc.mockReturnValue({
    get: jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({ sync_secret: SECRET })
    })
  });
}

function stubSuccessfulGradeSync() {
  const db = admin.firestore();
  const coll = db.collection();
  coll.where.mockReturnThis();
  stubAssignmentFound();
  coll.get
    .mockResolvedValueOnce({ empty: false, docs: [{ id: 'student_1' }] }) // profiles lookup
    .mockResolvedValueOnce({ empty: true });                              // submissions lookup
}

async function sendInvalid(req) {
  const res = makeRes();
  await myFunctions.webhook(req, res);
  return res;
}

describe('Webhook brute-force throttle', () => {
  let dateSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    dateSpy = jest.spyOn(Date, 'now');
    dateSpy.mockReturnValue(1_000_000_000_000);
  });

  afterEach(() => {
    dateSpy.mockRestore();
  });

  it('allows fewer than MAX_ATTEMPTS consecutive failures, then accepts a valid secret', async () => {
    stubAssignmentFound();
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
      const res = await sendInvalid(makeReq('10.0.0.1'));
      expect(res.status).toHaveBeenCalledWith(401);
    }

    stubSuccessfulGradeSync();
    const res = makeRes();
    await myFunctions.webhook(
      { method: 'POST', ip: '10.0.0.1', body: { assignmentId: 'a1', sync_secret: SECRET, grades: [{ matricula: 'M1', grade: '7' }] } },
      res
    );
    expect(res.json).toHaveBeenCalledWith({ success: true, updatedCount: 1 });
  });

  it('returns 429 after MAX_ATTEMPTS failures even with a valid secret', async () => {
    stubAssignmentFound();
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await sendInvalid(makeReq('10.0.0.2'));
    }

    stubAssignmentFound();
    const res = makeRes();
    await myFunctions.webhook(
      { method: 'POST', ip: '10.0.0.2', body: { assignmentId: 'a1', sync_secret: SECRET, grades: [] } },
      res
    );
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.send).toHaveBeenCalledWith('Demasiados intentos inválidos. Reintentá más tarde.');
  });

  it('tracks client IPs independently', async () => {
    stubAssignmentFound();
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await sendInvalid(makeReq('10.0.0.3'));
    }

    // A throttled IP stays blocked...
    stubAssignmentFound();
    const blocked = makeRes();
    await myFunctions.webhook(
      { method: 'POST', ip: '10.0.0.3', body: { assignmentId: 'a1', sync_secret: SECRET, grades: [] } },
      blocked
    );
    expect(blocked.status).toHaveBeenCalledWith(429);

    // ...while another IP is unaffected.
    stubSuccessfulGradeSync();
    const other = makeRes();
    await myFunctions.webhook(
      { method: 'POST', ip: '10.0.0.4', body: { assignmentId: 'a1', sync_secret: SECRET, grades: [{ matricula: 'M1', grade: '8' }] } },
      other
    );
    expect(other.json).toHaveBeenCalledWith({ success: true, updatedCount: 1 });
  });

  it('resets the attempt counter once the window elapses', async () => {
    stubAssignmentFound();
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await sendInvalid(makeReq('10.0.0.5'));
    }

    // Still inside the window: blocked.
    dateSpy.mockReturnValue(1_000_000_000_000 + WINDOW_MS - 1000);
    stubAssignmentFound();
    const insideWindow = makeRes();
    await myFunctions.webhook(
      { method: 'POST', ip: '10.0.0.5', body: { assignmentId: 'a1', sync_secret: SECRET, grades: [] } },
      insideWindow
    );
    expect(insideWindow.status).toHaveBeenCalledWith(429);

    // After the window: allowed again.
    dateSpy.mockReturnValue(1_000_000_000_000 + WINDOW_MS + 1000);
    stubSuccessfulGradeSync();
    const afterWindow = makeRes();
    await myFunctions.webhook(
      { method: 'POST', ip: '10.0.0.5', body: { assignmentId: 'a1', sync_secret: SECRET, grades: [{ matricula: 'M1', grade: '9' }] } },
      afterWindow
    );
    expect(afterWindow.json).toHaveBeenCalledWith({ success: true, updatedCount: 1 });
  });

  it('buckets requests without a resolvable IP together', async () => {
    stubAssignmentFound();
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await sendInvalid(makeReq(undefined));
    }

    stubAssignmentFound();
    const res = makeRes();
    await myFunctions.webhook(
      { method: 'POST', body: { assignmentId: 'a1', sync_secret: SECRET, grades: [] } },
      res
    );
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it('does not count OPTIONS preflights or malformed bodies toward the limit', async () => {
    // Malformed bodies (missing params) are rejected but never registered.
    for (let i = 0; i < MAX_ATTEMPTS + 3; i++) {
      const res = makeRes();
      await myFunctions.webhook(makeReq('10.0.0.6', { body: { assignmentId: 'a1' } }), res);
      expect(res.status).toHaveBeenCalledWith(400);
    }

    // Preflights short-circuit before the throttle check.
    for (let i = 0; i < 3; i++) {
      const res = makeRes();
      await myFunctions.webhook({ method: 'OPTIONS', ip: '10.0.0.6' }, res);
      expect(res.status).toHaveBeenCalledWith(204);
    }

    stubSuccessfulGradeSync();
    const res = makeRes();
    await myFunctions.webhook(
      { method: 'POST', ip: '10.0.0.6', body: { assignmentId: 'a1', sync_secret: SECRET, grades: [{ matricula: 'M1', feedback: 'ok' }] } },
      res
    );
    expect(res.json).toHaveBeenCalledWith({ success: true, updatedCount: 1 });
  });
});
