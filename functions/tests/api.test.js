const test = require('firebase-functions-test')();

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
      batch: batchMock
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

  it('exportAttendanceCsv returns 400 if courseId or token is missing', async () => {
    const req = { query: {}, set: jest.fn() };
    const res = {
      set: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn()
    };
    await myFunctions.exportAttendanceCsv(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Falta courseId o token');
  });
});
