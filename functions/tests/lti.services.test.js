const { generateKeyPairSync } = require('node:crypto');

const toolKey = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
process.env.LTI_TOOL_PRIVATE_KEY = toolKey.privateKey;

const { memoryDb, handlerContext } = require('./helpers/memoryDb');
const { authorizeAction } = require('../src/authz');
const { decodeJwt, verifyJwt } = require('../src/lib/lti/jwt');
const { platformDocId, contextDocId } = require('../src/lib/lti/launch');
const { registerWithPlatform, toolConfiguration } = require('../src/lib/lti/registration');
const { clearTokenCache } = require('../src/lib/lti/services');
const lti = require('../src/modules/integrations/lti');

const ISS = 'https://campus.unrn.edu.ar';
const PID = platformDocId(ISS, 'client-1');
const CTX = contextDocId(PID, '7', 'moodle-55');
const MEMBERS_URL = `${ISS}/mod/lti/services.php/55/memberships`;
const LINEITEMS_URL = `${ISS}/mod/lti/services.php/55/lineitems`;
const LEARNER = ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'];

/** Moodle simulado: token, NRPS en dos páginas y AGS. */
function fakeMoodle({ members }) {
  const calls = [];
  const json = (body, headers = {}) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body), headers: { get: (h) => headers[h.toLowerCase()] || null } });
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const u = new URL(url);
    if (u.pathname.endsWith('/token.php')) return json({ access_token: 'tok', expires_in: 3600 });
    if (String(url) === MEMBERS_URL) return json({ members: members.slice(0, 1) }, { link: `<${MEMBERS_URL}?page=2>; rel="next"` });
    if (String(url) === `${MEMBERS_URL}?page=2`) return json({ members: members.slice(1) });
    if (u.pathname.endsWith('/lineitems') && !init.method) return json([]);
    if (u.pathname.endsWith('/lineitems') && init.method === 'POST') return json({ id: `${LINEITEMS_URL}/9`, scoreMaximum: 100, ...JSON.parse(init.body) , scoreMaximum: 100 });
    if (u.pathname.endsWith('/lineitems/9/scores')) return json({});
    return { ok: false, status: 404, text: async () => 'nope', headers: { get: () => null } };
  };
  return { fetchImpl, calls };
}

function seed(status = 'approved') {
  return memoryDb({
    [`lti_platforms/${PID}`]: { issuer: ISS, client_id: 'client-1', deployment_ids: ['7'], status, course_ids: ['c1'],
      auth_token_url: `${ISS}/mod/lti/token.php`, auth_login_url: `${ISS}/mod/lti/auth.php`, jwks_url: `${ISS}/mod/lti/certs.php` },
    [`lti_contexts/${CTX}`]: { course_id: 'c1', platform_id: PID, nrps_url: MEMBERS_URL, ags_lineitems_url: LINEITEMS_URL,
      ags_scopes: ['https://purl.imsglobal.org/spec/lti-ags/scope/score', 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem'] },
    'courses/c1': { name: 'Programación I' },
    'profiles/titular': { role: 'teacher' },
    'profiles/ta': { role: 'teacher' },
    'profiles/boss': { role: 'admin' },
    'profiles/ana': { role: 'student', email: 'ana@unrn.edu.ar', lti_subs: { [PID]: '101' } },
    'course_teachers/c1_titular': { course_id: 'c1', teacher_id: 'titular', role: 'titular' },
    'course_teachers/c1_ta': { course_id: 'c1', teacher_id: 'ta', role: 'ayudante' },
    'course_roster/c1_ana': { course_id: 'c1', student_id: 'ana', status: 'approved', enrolled_via: 'lti' },
    'course_roster/c1_gone': { course_id: 'c1', student_id: 'gone', status: 'approved', enrolled_via: 'lti' },
    'course_roster/c1_manual': { course_id: 'c1', student_id: 'manual', status: 'approved' },
    'assignments/tp1': { course_id: 'c1', title: 'TP1' },
    'submissions/s1': { assignment_id: 'tp1', student_id: 'ana', grade: '7,5', feedback: 'Bien' },
    'submissions/s2': { assignment_id: 'tp1', student_id: 'manual', grade: '9' },
  });
}

const call = async (db, uid, action, payload) => {
  const authorized = await authorizeAction(action, payload, { uid, db, profile: db.docs[`profiles/${uid}`] });
  return lti[action](authorized, handlerContext(db, uid));
};

beforeEach(() => clearTokenCache());

describe('dynamic registration', () => {
  test('registers with the platform and returns its endpoints', async () => {
    const posted = [];
    const fetchImpl = async (url, init = {}) => {
      if (url === `${ISS}/mod/lti/openid-configuration.php`) {
        return { ok: true, json: async () => ({ issuer: ISS, authorization_endpoint: `${ISS}/auth`, token_endpoint: `${ISS}/token`, jwks_uri: `${ISS}/certs`, registration_endpoint: `${ISS}/register` }) };
      }
      posted.push({ url, init });
      return { ok: true, json: async () => ({ client_id: 'new-client', 'https://purl.imsglobal.org/spec/lti-tool-configuration': { deployment_id: '12' } }) };
    };
    const reg = await registerWithPlatform({ openidConfigurationUrl: `${ISS}/mod/lti/openid-configuration.php`, registrationToken: 'rt', baseUrl: 'https://dojo.example', courseId: 'c1', fetchImpl });
    expect(reg).toMatchObject({ issuer: ISS, client_id: 'new-client', deployment_ids: ['12'], jwks_url: `${ISS}/certs` });
    expect(posted[0].init.headers.Authorization).toBe('Bearer rt');
    expect(JSON.parse(posted[0].init.body)['https://purl.imsglobal.org/spec/lti-tool-configuration'].custom_parameters).toEqual({ courseId: 'c1' });
  });

  test('rejects an issuer that does not match the configuration URL', async () => {
    const fetchImpl = async () => ({ ok: true, json: async () => ({ issuer: 'https://evil.example', authorization_endpoint: 'x' }) });
    await expect(registerWithPlatform({ openidConfigurationUrl: `${ISS}/conf`, baseUrl: 'https://dojo.example', courseId: 'c1', fetchImpl }))
      .rejects.toMatchObject({ code: 'invalid_platform' });
  });

  test('declares launch, JWKS and the AGS/NRPS scopes', () => {
    const cfg = toolConfiguration({ baseUrl: 'https://dojo.example', courseId: 'c1' });
    expect(cfg.redirect_uris).toEqual(['https://dojo.example/api/v1/lti/launch']);
    expect(cfg.scope).toContain('contextmembership.readonly');
    expect(cfg.scope).toContain('lti-ags/scope/score');
  });
});

describe('platform management', () => {
  test('only the titular registers platforms, only admins approve them', async () => {
    const db = seed();
    const manual = { courseId: 'c1', issuer: 'https://otro.unrn.edu.ar', clientId: 'x', deploymentId: '1',
      authLoginUrl: 'https://otro.unrn.edu.ar/auth', authTokenUrl: 'https://otro.unrn.edu.ar/token', jwksUrl: 'https://otro.unrn.edu.ar/certs' };
    await expect(call(db, 'ta', 'registerLtiPlatform', manual)).rejects.toThrow(/titular/);
    await expect(call(db, 'titular', 'registerLtiPlatform', { ...manual, jwksUrl: 'http://10.0.0.1/certs' })).rejects.toThrow(/https/);
    const { id, status } = await call(db, 'titular', 'registerLtiPlatform', manual);
    expect(status).toBe('pending');

    await expect(call(db, 'titular', 'setLtiPlatformStatus', { platformId: id, status: 'approved' })).rejects.toMatchObject({ code: 'permission-denied' });
    await call(db, 'boss', 'setLtiPlatformStatus', { platformId: id, status: 'approved' });
    expect(db.docs[`lti_platforms/${id}`].status).toBe('approved');

    const { token } = await call(db, 'titular', 'createLtiRegistrationToken', { courseId: 'c1' });
    expect(db.docs[`lti_registrations/${token}`]).toMatchObject({ course_id: 'c1', owner_uid: 'titular' });
  });
});

describe('NRPS roster sync', () => {
  test('adds new learners, marks LTI learners who left as baja and skips unchanged rosters', async () => {
    const db = seed();
    const members = [
      { user_id: '101', roles: LEARNER, status: 'Active', email: 'ana@unrn.edu.ar', name: 'Ana' },
      { user_id: '202', roles: LEARNER, status: 'Active', email: 'beto@unrn.edu.ar', name: 'Beto', lis_person_sourcedid: 'UNRN-2020' },
      { user_id: '303', roles: LEARNER, status: 'Inactive', name: 'Ex' },
    ];
    const moodle = fakeMoodle({ members });
    global.fetch = moodle.fetchImpl;

    const report = await call(db, 'ta', 'syncLtiRoster', { courseId: 'c1' });
    expect(report).toMatchObject({ added: 1, removed: 1, unchanged: 0 });
    const beto = Object.entries(db.docs).find(([p, d]) => p.startsWith('profiles/') && d.email === 'beto@unrn.edu.ar');
    expect(beto[1]).toMatchObject({ matricula_unrn: 'UNRN-2020', role: 'student' });
    expect(beto[1].ultima_actividad_moodle).toBeUndefined();
    expect(db.docs['course_roster/c1_gone'].status).toBe('baja');
    expect(db.docs['course_roster/c1_manual'].status).toBe('approved'); // no vino por LTI: no se toca

    // The client_credentials assertion is signed by the tool.
    const tokenCall = moodle.calls.find((c) => c.url.endsWith('/token.php'));
    const assertion = new URLSearchParams(tokenCall.init.body).get('client_assertion');
    await expect(verifyJwt(assertion, () => toolKey.publicKey)).resolves.toBeTruthy();
    expect(decodeJwt(assertion).payload).toMatchObject({ iss: 'client-1', sub: 'client-1', aud: `${ISS}/mod/lti/token.php` });

    expect((await call(db, 'ta', 'syncLtiRoster', { courseId: 'c1' })).unchanged).toBe(1);
  });
});

describe('AGS grade publishing', () => {
  test('scales 0-10 grades to the line item maximum and skips students without an LTI identity', async () => {
    const db = seed();
    const moodle = fakeMoodle({ members: [] });
    global.fetch = moodle.fetchImpl;
    const report = await call(db, 'ta', 'publishLtiGrades', { courseId: 'c1', assignmentId: 'tp1' });
    expect(report).toMatchObject({ published: 1, skipped: 1, failed: [] });
    const score = moodle.calls.find((c) => c.url.endsWith('/scores'));
    expect(JSON.parse(score.init.body)).toMatchObject({ userId: '101', scoreGiven: 75, scoreMaximum: 100, comment: 'Bien', gradingProgress: 'FullyGraded' });
    const created = moodle.calls.find((c) => c.url === LINEITEMS_URL && c.init.method === 'POST');
    expect(JSON.parse(created.init.body)).toMatchObject({ resourceId: 'assignment:tp1', label: 'TP1' });
  });

  test('requires exactly one activity and a linked AGS context', async () => {
    const db = seed();
    await expect(call(db, 'ta', 'publishLtiGrades', { courseId: 'c1' })).rejects.toMatchObject({ code: 'invalid-argument' });
    delete db.docs[`lti_contexts/${CTX}`];
    await expect(call(db, 'ta', 'publishLtiGrades', { courseId: 'c1', assignmentId: 'tp1' })).rejects.toMatchObject({ code: 'failed-precondition' });
  });
});

describe('deep linking response', () => {
  test('is signed by the tool, addressed to the platform and echoes data', async () => {
    const { buildDeepLinkingResponse } = require('../src/lib/lti/deepLinking');
    const { currentSigningKey } = require('../src/lib/lti/keys');
    const jwt = buildDeepLinkingResponse({
      platform: { issuer: ISS, client_id: 'client-1' }, deploymentId: '7', data: 'opaque', signingKey: currentSigningKey(),
      items: [{ title: 'TP1', url: 'https://dojo.example/api/v1/lti/launch', custom: { courseId: 'c1', assignmentId: 'tp1' } }],
    });
    const { payload, header } = await verifyJwt(jwt, () => toolKey.publicKey);
    expect(header.kid).toBe(currentSigningKey().kid);
    expect(payload).toMatchObject({ iss: 'client-1', aud: ISS, 'https://purl.imsglobal.org/spec/lti-dl/claim/data': 'opaque' });
    expect(payload['https://purl.imsglobal.org/spec/lti/claim/message_type']).toBe('LtiDeepLinkingResponse');
    expect(payload['https://purl.imsglobal.org/spec/lti-dl/claim/content_items'][0]).toMatchObject({ type: 'ltiResourceLink', custom: { assignmentId: 'tp1' } });
  });
});
