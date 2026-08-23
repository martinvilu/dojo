const test = require('firebase-functions-test')();

// Modules like src/modules/course/export.js import Firestore helpers from
// the 'firebase-admin/firestore' subpath; delegate them to the mocked
// 'firebase-admin' main entry so both share the same fakes.
jest.mock('firebase-admin/firestore', () => ({
  getFirestore: () => require('firebase-admin').firestore(),
  FieldValue: { serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP') }
}));

jest.mock('firebase-admin', () => {
  const getMock = jest.fn();
  const setMock = jest.fn();
  const updateMock = jest.fn();
  const addMock = jest.fn().mockResolvedValue({ id: 'new_id' });
  const whereMock = jest.fn().mockReturnThis();
  const orderByMock = jest.fn().mockReturnThis();
  const limitMock = jest.fn().mockReturnThis();
  const docMock = jest.fn();
  const collectionMock = jest.fn();
  const batchMock = jest.fn();

  const fakeCollection = {
    doc: docMock,
    add: addMock,
    where: whereMock,
    orderBy: orderByMock,
    limit: limitMock,
    get: getMock
  };

  const fakeDoc = {
    set: setMock,
    update: updateMock,
    get: getMock,
    delete: jest.fn()
  };

  collectionMock.mockReturnValue(fakeCollection);
  docMock.mockReturnValue(fakeDoc);
  
  const fakeBatch = {
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn()
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

describe('API Callable Function', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('throws unauthenticated error if not logged in', async () => {
    await expect(
      myFunctions.api.run({ data: { action: 'getProfile' }, auth: null })
    ).rejects.toThrow('Must be logged in.');
  });

  it('can create a new course', async () => {
    const db = admin.firestore();
    await myFunctions.api.run({
      data: { action: 'createCourse', payload: { name: 'Test Course' } },
      auth: { uid: 'user_uid' }
    });
    expect(db.collection().add).toHaveBeenCalled();
  });

  it('calendar endpoint returns 400 if course ID is missing', async () => {
    const req = { query: {} };
    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn()
    };
    await myFunctions.calendar(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Falta el ID del curso');
  });

  it('calendar endpoint returns 401 when the subscription token is missing or wrong', async () => {
    const db = admin.firestore();
    db.collection('courses').doc('c1').get = jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({ name: 'Algoritmos', sync_secret: 'SECRETO1' })
    });

    const resFor = (token) => {
      const req = { query: token === undefined ? { id: 'c1' } : { id: 'c1', token } };
      const res = { status: jest.fn().mockReturnThis(), set: jest.fn(), send: jest.fn() };
      return { req, res };
    };

    const noToken = resFor(undefined);
    await myFunctions.calendar(noToken.req, noToken.res);
    expect(noToken.res.status).toHaveBeenCalledWith(401);

    const badToken = resFor('OTROTOKEN');
    await myFunctions.calendar(badToken.req, badToken.res);
    expect(badToken.res.status).toHaveBeenCalledWith(401);
    expect(badToken.res.send).toHaveBeenCalledWith('Token de suscripción inválido');
  });

  it('calendar endpoint serves the iCal feed with a valid subscription token', async () => {
    const db = admin.firestore();
    db.collection('courses').doc('c1').get = jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        name: 'Algoritmos',
        sync_secret: 'SECRETO1',
        class_instances: [
          { date: '2026-08-24', type: 'Teórica', topic: 'Funciones' }
        ]
      })
    });

    const req = { query: { id: 'c1', token: 'SECRETO1' } };
    const res = { status: jest.fn().mockReturnThis(), set: jest.fn(), send: jest.fn() };
    await myFunctions.calendar(req, res);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.set).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('BEGIN:VCALENDAR'));
  });

  it('exportGradesCsv and exportAttendanceCsv were unified into the App Router route', () => {
    // GET /api/export/csv (src/app/api/export/csv/route.ts) reemplaza estos
    // endpoints; no deben volver a exponerse desde Functions.
    expect(myFunctions.exportGradesCsv).toBeUndefined();
    expect(myFunctions.exportAttendanceCsv).toBeUndefined();
  });
});
