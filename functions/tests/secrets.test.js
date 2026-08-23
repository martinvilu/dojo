const test = require('firebase-functions-test')();

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
  const fakeDoc = { get: getMock, set: jest.fn(), update: jest.fn() };
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

// Strong subscription tokens: 32 uppercase hex chars (crypto.randomBytes(16))
const STRONG_SECRET_RE = /^[0-9A-F]{32}$/;

describe('Subscription secret strength', () => {
  let db;

  beforeEach(() => {
    db = admin.firestore();
    jest.clearAllMocks();
  });

  function createdPayloadsWithSecret(collectionName) {
    // The router also writes audit-log entries through collection.add; keep
    // only real domain payloads carrying the subscription secret.
    return db.collection(collectionName).add.mock.calls
      .map((c) => c[0])
      .filter((p) => p && typeof p.sync_secret === "string");
  }

  it('generates a strong sync_secret when creating a course', async () => {
    await myFunctions.api.run({
      data: { action: 'createCourse', payload: { name: 'Seguridad' } },
      auth: { uid: 'teacher_uid' }
    });

    const [payload] = createdPayloadsWithSecret('courses');
    expect(payload.sync_secret).toMatch(STRONG_SECRET_RE);
  });

  it('generates a strong sync_secret when creating an assignment', async () => {
    // Membership check for the creating teacher
    db.collection().doc.mockReturnValue({
      get: jest.fn().mockResolvedValue({ exists: true, data: () => ({}) })
    });

    await myFunctions.api.run({
      data: { action: 'createAssignment', payload: { course_id: 'course123', title: 'TP 1' } },
      auth: { uid: 'teacher_uid' }
    });

    const [payload] = createdPayloadsWithSecret('assignments');
    expect(payload.sync_secret).toMatch(STRONG_SECRET_RE);
  });

  it('never reuses the same secret across creations', async () => {
    await myFunctions.api.run({
      data: { action: 'createCourse', payload: { name: 'A' } },
      auth: { uid: 'teacher_uid' }
    });
    await myFunctions.api.run({
      data: { action: 'createCourse', payload: { name: 'B' } },
      auth: { uid: 'teacher_uid' }
    });

    const payloads = createdPayloadsWithSecret('courses');
    expect(payloads.length).toBe(2);
    expect(payloads[0].sync_secret).not.toEqual(payloads[1].sync_secret);
    expect(payloads[0].sync_secret).toMatch(STRONG_SECRET_RE);
    expect(payloads[1].sync_secret).toMatch(STRONG_SECRET_RE);
  });
});
