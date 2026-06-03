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

describe('Webhook Logic', () => {
  let db;

  beforeEach(() => {
    db = admin.firestore();
    jest.clearAllMocks();
  });

  it('rejects webhook without secret', async () => {
    const req = { method: 'POST', body: { assignmentId: '123' } };
    const res = { set: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn(), json: jest.fn() };
    
    await myFunctions.webhook(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Faltan parametros requeridos');
  });

  it('verifies secret token correctly in webhook', async () => {
    db.collection('assignments').doc('123').get = jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({ sync_secret: 'real_secret' })
    });
    
    const req = { method: 'POST', body: { assignmentId: '123', sync_secret: 'wrong_secret', grades: [] } };
    const res = { set: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn(), json: jest.fn() };
    
    await myFunctions.webhook(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });
  
  it('updates grades successfully in webhook', async () => {
    db.collection('assignments').doc('123').get = jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({ sync_secret: 'real_secret' })
    });
    
    const profileGetMock = jest.fn().mockResolvedValue({
        empty: false,
        docs: [{ id: 'student_123' }]
    });
    const subGetMock = jest.fn().mockResolvedValue({
        empty: false,
        docs: [{ ref: 'fakeRef' }]
    });
    
    db.collection('profiles').where().get = profileGetMock;
    db.collection('submissions').where().where().get = subGetMock;
    
    const req = { 
        method: 'POST', 
        body: { 
            assignmentId: '123', 
            sync_secret: 'real_secret', 
            grades: [ { matricula: 'AAA', grade: '10' } ] 
        } 
    };
    const res = { set: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn(), json: jest.fn() };
    
    await myFunctions.webhook(req, res);
    expect(res.json).toHaveBeenCalledWith({ success: true, updatedCount: 1 });
  });
});
