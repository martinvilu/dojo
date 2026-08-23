const test = require('firebase-functions-test')();

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: () => require('firebase-admin').firestore(),
  FieldValue: { serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP') }
}));

// Stateful fake: documents are keyed by id so each collection.doc(id) call
// returns a stable doc spy that tests can seed and inspect.
jest.mock('firebase-admin', () => {
  const makeDoc = (id) => ({
    id,
    get: jest.fn(),
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  });
  const state = { docsById: {}, batches: [] };

  const docMock = jest.fn((id) => {
    if (!state.docsById[id]) state.docsById[id] = makeDoc(id);
    return state.docsById[id];
  });

  const batchMock = jest.fn(() => {
    const b = { update: jest.fn(), set: jest.fn(), delete: jest.fn(), commit: jest.fn().mockResolvedValue({}) };
    state.batches.push(b);
    return b;
  });

  const collectionMock = jest.fn(() => ({ doc: docMock, add: jest.fn(), where: jest.fn().mockReturnThis(), get: jest.fn() }));

  return {
    initializeApp: jest.fn(),
    __state: state,
    firestore: Object.assign(() => ({ collection: collectionMock, batch: batchMock, settings: jest.fn() }), {
      FieldValue: { serverTimestamp: jest.fn() }
    }),
    auth: () => ({ verifyIdToken: jest.fn() })
  };
});

const admin = require('firebase-admin');
const { importGrades } = require('../src/modules/course/export');

const COURSE = { sync_secret: 'SECRETO32HEXUPPERCASE000000' };

function seedCourse(courseId = 'c1', secret = COURSE.sync_secret) {
  const courseDoc = admin.__state.docsById[courseId];
  if (courseDoc) delete admin.__state.docsById[courseId];
  const doc = require('../src/modules/course/export') && null; // noop guard
  // Seed through the same factory the handler will resolve.
  const d = admin.firestore().collection('courses').doc(courseId);
  d.get.mockResolvedValue({ exists: true, data: () => ({ sync_secret: secret }) });
  return d;
}

function seedSubmission(id, data, exists = true) {
  const d = admin.firestore().collection('submissions').doc(id);
  d.get.mockResolvedValue({ exists, data: () => data });
  return d;
}

function seedProfile(studentId, data) {
  const d = admin.firestore().collection('profiles').doc(studentId);
  d.get.mockResolvedValue({ exists: true, data: () => data });
  return d;
}

function makeRes() {
  return {
    set: jest.fn(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
    json: jest.fn()
  };
}

function makeReq(overrides = {}) {
  return {
    method: 'POST',
    query: { courseId: 'c1', token: COURSE.sync_secret },
    headers: { 'content-type': 'application/json' },
    body: [],
    ...overrides
  };
}

beforeEach(() => {
  admin.__state.docsById = {};
  admin.__state.batches.length = 0;
  jest.clearAllMocks();
  seedCourse();
});

describe('importGrades endpoint', () => {
  it('short-circuits OPTIONS preflights', async () => {
    const res = makeRes();
    await importGrades(makeReq({ method: 'OPTIONS' }), res);
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it('rejects non-POST methods', async () => {
    const res = makeRes();
    await importGrades(makeReq({ method: 'GET' }), res);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.send).toHaveBeenCalledWith('Method Not Allowed');
  });

  it('requires courseId and token', async () => {
    const res = makeRes();
    await importGrades(makeReq({ query: {} }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Falta courseId o token');
  });

  it('returns 404 for unknown courses', async () => {
    admin.firestore().collection('courses').doc('nope').get
      .mockResolvedValue({ exists: false, data: () => ({}) });
    const res = makeRes();
    await importGrades(makeReq({ query: { courseId: 'nope', token: 'x' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith('Materia no encontrada');
  });

  it('returns 401 on invalid subscription token', async () => {
    const res = makeRes();
    await importGrades(makeReq({ query: { courseId: 'c1', token: 'OTRO' } }), res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith('Token inválido');
  });

  it('imports JSON rows updating grades, feedback and notifying students', async () => {
    seedSubmission('sub1', { student_id: 's1' });
    seedProfile('s1', { notification_pref: 'immediate' });

    const res = makeRes();
    await importGrades(makeReq({
      body: [
        { id_entrega: 'sub1', resultado: '9', comentario_general: 'Excelente' },
        { resultado: 'sin id' }
      ]
    }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({ success: true, updatedCount: 1 });

    const batch = admin.__state.batches[0];
    expect(batch.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sub1' }),
      expect.objectContaining({ grade: '9', feedback: 'Excelente' })
    );
    expect(batch.set).toHaveBeenCalledTimes(1);
    const [, notif] = batch.set.mock.calls[0];
    expect(notif.student_id).toBe('s1');
    expect(notif.message).toContain('9');
    expect(notif.is_daily_pending).toBe(false);
    await expect(batch.commit.mock.results[0].value).resolves.toEqual({});
  });

  it('flags daily-summary notifications for students with that preference', async () => {
    seedSubmission('sub2', { student_id: 's2' });
    seedProfile('s2', { notification_pref: 'daily_summary' });

    const res = makeRes();
    await importGrades(makeReq({
      body: [{ id_entrega: 'sub2', comentario_general: 'Revisar estilo' }]
    }), res);

    const batch = admin.__state.batches[0];
    const [, notif] = batch.set.mock.calls[0];
    expect(notif.is_daily_pending).toBe(true);
    // Feedback-only corrections notify without a grade in the message
    expect(notif.message).toContain('Tu entrega ha sido corregida');
    expect(notif.message).not.toContain('Nota');
  });

  it('skips submissions that do not exist', async () => {
    seedSubmission('ghost', {}, false);

    const res = makeRes();
    await importGrades(makeReq({
      body: [{ id_entrega: 'ghost', resultado: '4' }]
    }), res);

    expect(res.send).toHaveBeenCalledWith({ success: true, updatedCount: 0 });
    const batch = admin.__state.batches[0];
    expect(batch.update).not.toHaveBeenCalled();
    expect(batch.set).not.toHaveBeenCalled();
  });

  it('parses semicolon-separated CSV payloads', async () => {
    seedSubmission('sub3', { student_id: 's3' });
    seedProfile('s3', {});

    const csv = 'id_entrega;nota;comentario\nsub3;7;bien pero mejorable';
    const res = makeRes();
    await importGrades(makeReq({
      headers: { 'content-type': 'text/csv' },
      body: Buffer.from(csv, 'utf8')
    }), res);

    const batch = admin.__state.batches[0];
    expect(batch.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sub3' }),
      expect.objectContaining({ grade: '7', feedback: 'bien pero mejorable' })
    );
    expect(res.send).toHaveBeenCalledWith({ success: true, updatedCount: 1 });
  });

  it('parses comma-separated CSV payloads too', async () => {
    seedSubmission('sub4', { student_id: 's4' });
    seedProfile('s4', {});

    const csv = '"id_entrega","nota","comentario"\n"sub4","6","ok"';
    const res = makeRes();
    await importGrades(makeReq({
      headers: { 'content-type': 'text/csv' },
      body: Buffer.from(csv, 'utf8')
    }), res);

    const batch = admin.__state.batches[0];
    expect(batch.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sub4' }),
      expect.objectContaining({ grade: '6', feedback: 'ok' })
    );
  });

  it('rejects CSV without an id_entrega column', async () => {
    const res = makeRes();
    await importGrades(makeReq({
      headers: { 'content-type': 'text/csv' },
      body: Buffer.from('nota;comentario\n1;x', 'utf8')
    }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("El CSV debe tener columna 'id_entrega'");
  });

  it('rejects unsupported content types', async () => {
    const res = makeRes();
    await importGrades(makeReq({
      headers: { 'content-type': 'text/plain' },
      body: 'hola'
    }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Content-Type debe ser application/json o text/csv');
  });
});
