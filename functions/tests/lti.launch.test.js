const { generateKeyPairSync } = require('node:crypto');
const { memoryDb, handlerContext } = require('./helpers/memoryDb');
const { signJwt, verifyJwt, decodeJwt } = require('../src/lib/lti/jwt');
const { startLogin, completeLaunch, redeemHandoff, platformDocId, ltiUserDocId } = require('../src/lib/lti/launch');
const { mapLtiRole, CLAIM } = require('../src/lib/lti/claims');
const { toolJwks, currentSigningKey } = require('../src/lib/lti/keys');

const BASE = 'https://dojo.example.edu';
const ISS = 'https://campus.unrn.edu.ar';
const CLIENT = 'dojo-client-1';
const PID = platformDocId(ISS, CLIENT);
const ROLES = {
  learner: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
  instructor: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],
  ta: ['http://purl.imsglobal.org/vocab/lis/v2/membership/Instructor#TeachingAssistant'],
  admin: ['http://purl.imsglobal.org/vocab/lis/v2/institution/person#Administrator'],
};

const platformKeys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const platformJwk = { ...platformKeys.publicKey.export({ format: 'jwk' }), kid: 'moodle-1' };
const platformSigner = { privateKey: platformKeys.privateKey, kid: 'moodle-1' };
const resolvePlatformKey = async (url, kid) => (url === `${ISS}/mod/lti/certs.php` && kid === 'moodle-1' ? platformJwk : null);

function seed(status = 'approved') {
  return memoryDb({
    [`lti_platforms/${PID}`]: {
      issuer: ISS, client_id: CLIENT, deployment_ids: ['7'], status, course_ids: ['c1'],
      auth_login_url: `${ISS}/mod/lti/auth.php`, auth_token_url: `${ISS}/mod/lti/token.php`, jwks_url: `${ISS}/mod/lti/certs.php`,
    },
    'courses/c1': { name: 'Programación I' },
    'profiles/ana': { role: 'student', email: 'ana@unrn.edu.ar', full_name: 'Ana', account_status: 'pending' },
    'profiles/boss': { role: 'admin', email: 'boss@unrn.edu.ar' },
  });
}

const admin = handlerContext(null, 'x').admin;

async function login(db) {
  return startLogin(db, { iss: ISS, client_id: CLIENT, login_hint: 'h', target_link_uri: `${BASE}/api/v1/lti/launch`, lti_deployment_id: '7' }, { baseUrl: BASE });
}

function idToken(db, state, overrides = {}, signer = platformSigner) {
  const nonce = db.docs[`lti_states/${state}`]?.nonce;
  return signJwt({
    iss: ISS, aud: CLIENT, sub: '19284', nonce, email: 'ana@unrn.edu.ar', name: 'Ana Pérez',
    [CLAIM.VERSION]: '1.3.0',
    [CLAIM.MESSAGE_TYPE]: 'LtiResourceLinkRequest',
    [CLAIM.DEPLOYMENT_ID]: '7',
    [CLAIM.RESOURCE_LINK]: { id: 'rl-1' },
    [CLAIM.ROLES]: ROLES.learner,
    [CLAIM.CONTEXT]: { id: 'moodle-course-55', title: 'Programación I' },
    [CLAIM.CUSTOM]: { courseId: 'c1' },
    [CLAIM.LIS]: { person_sourcedid: 'unrn-15772' },
    [CLAIM.NRPS]: { context_memberships_url: `${ISS}/mod/lti/services.php/55/memberships` },
    [CLAIM.AGS]: { lineitems: `${ISS}/mod/lti/services.php/55/lineitems`, scope: ['https://purl.imsglobal.org/spec/lti-ags/scope/score'] },
    ...overrides,
  }, signer);
}

async function launch(db, overrides, opts = {}) {
  const { state } = await login(db);
  return completeLaunch(db, { idToken: idToken(db, state, overrides, opts.signer), state, cookieState: opts.cookie === undefined ? state : opts.cookie },
    { admin, resolvePlatformKey });
}

describe('LTI JWT', () => {
  test('rejects alg none and tampered payloads', async () => {
    const good = signJwt({ a: 1 }, platformSigner);
    const [h, p] = good.split('.');
    const none = `${Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url')}.${p}.`;
    await expect(verifyJwt(none, () => platformJwk)).rejects.toMatchObject({ code: 'invalid_signature' });
    const tampered = `${h}.${Buffer.from(JSON.stringify({ a: 2, exp: 9e9 })).toString('base64url')}.${good.split('.')[2]}`;
    await expect(verifyJwt(tampered, () => platformJwk)).rejects.toMatchObject({ code: 'invalid_signature' });
    await expect(verifyJwt(signJwt({ a: 1 }, platformSigner, { expiresInSeconds: -600 }), () => platformJwk)).rejects.toMatchObject({ code: 'expired' });
  });

  test('maps LTI roles without ever granting Dojo admin', () => {
    expect(mapLtiRole(ROLES.learner)).toBe('learner');
    expect(mapLtiRole(ROLES.instructor)).toBe('instructor');
    expect(mapLtiRole([...ROLES.instructor, ...ROLES.ta])).toBe('ta');
    expect(mapLtiRole(ROLES.admin)).toBe('instructor');
    expect(mapLtiRole(['http://purl.imsglobal.org/vocab/lis/v2/membership#Mentor'])).toBe('none');
  });

  test('publishes the tool JWKS and refuses to sign without a key', () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
    const env = { LTI_TOOL_PRIVATE_KEY: privateKey.replace(/\n/g, '\\n') };
    const { keys } = toolJwks(env);
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatchObject({ kty: 'RSA', alg: 'RS256', use: 'sig' });
    expect(keys[0]).not.toHaveProperty('d');
    expect(keys[0].kid).toBe(currentSigningKey(env).kid);
    expect(() => currentSigningKey({})).toThrow(/LTI_TOOL_PRIVATE_KEY/);
  });
});

describe('OIDC login initiation', () => {
  test('redirects to the platform with state and nonce', async () => {
    const db = seed();
    const { redirectUrl, state } = await login(db);
    const url = new URL(redirectUrl);
    expect(url.origin + url.pathname).toBe(`${ISS}/mod/lti/auth.php`);
    expect(url.searchParams.get('response_mode')).toBe('form_post');
    expect(url.searchParams.get('redirect_uri')).toBe(`${BASE}/api/v1/lti/launch`);
    expect(url.searchParams.get('state')).toBe(state);
    expect(url.searchParams.get('nonce')).toBe(db.docs[`lti_states/${state}`].nonce);
  });

  test('rejects unknown platforms, foreign targets and unregistered deployments', async () => {
    const db = seed();
    await expect(startLogin(db, { iss: 'https://evil.example', login_hint: 'h', target_link_uri: `${BASE}/x` }, { baseUrl: BASE }))
      .rejects.toMatchObject({ code: 'unknown_platform' });
    await expect(startLogin(db, { iss: ISS, client_id: CLIENT, login_hint: 'h', target_link_uri: 'https://evil.example/' }, { baseUrl: BASE }))
      .rejects.toMatchObject({ code: 'invalid_request' });
    await expect(startLogin(db, { iss: ISS, client_id: CLIENT, login_hint: 'h', target_link_uri: `${BASE}/a`, lti_deployment_id: '99' }, { baseUrl: BASE }))
      .rejects.toMatchObject({ code: 'invalid_deployment' });
  });
});

describe('verified launch', () => {
  test('links an approved platform learner to the existing account, enrolls and records the context', async () => {
    const db = seed('approved');
    const res = await launch(db);
    expect(res).toMatchObject({ uid: 'ana', courseId: 'c1', role: 'student' });
    expect(db.docs['profiles/ana']).toMatchObject({ account_status: 'approved', moodle_user_id: '19284', matricula_unrn: 'UNRN-15772' });
    expect(db.docs['profiles/ana'].lti_subs[PID]).toBe('19284');
    expect(db.docs['course_roster/c1_ana']).toMatchObject({ status: 'approved', enrolled_via: 'lti' });
    const context = Object.entries(db.docs).find(([p]) => p.startsWith('lti_contexts/'))[1];
    expect(context).toMatchObject({ course_id: 'c1', nrps_url: `${ISS}/mod/lti/services.php/55/memberships` });

    const handoff = await redeemHandoff(db, res.code);
    expect(handoff).toEqual({ uid: 'ana', redirect: '/dashboard?courseId=c1&lti_launch=verified' });
    await expect(redeemHandoff(db, res.code)).rejects.toMatchObject({ code: 'invalid_handoff' }); // un solo uso
  });

  test('a pending platform never links to existing accounts and keeps students pending', async () => {
    const db = seed('pending');
    const res = await launch(db);
    expect(res.uid).not.toBe('ana');
    expect(res.uid).toMatch(/^lti_/);
    expect(db.docs[`profiles/${res.uid}`]).toMatchObject({ role: 'student', account_status: 'pending', created_via: 'lti' });
    expect(db.docs[`course_roster/c1_${res.uid}`].status).toBe('pending');
    await expect(launch(db, { [CLAIM.ROLES]: ROLES.instructor, sub: '2' })).rejects.toMatchObject({ code: 'platform_pending' });
  });

  test('never links a launch to an admin account', async () => {
    const db = seed('approved');
    const res = await launch(db, { email: 'boss@unrn.edu.ar', sub: '1', [CLAIM.LIS]: {} });
    expect(res.uid).not.toBe('boss');
    expect(db.docs['profiles/boss'].lti_subs).toBeUndefined();
  });

  test('instructors become titular and TAs ayudante of the linked course', async () => {
    const db = seed('approved');
    const t = await launch(db, { [CLAIM.ROLES]: ROLES.instructor, sub: '10', email: 'prof@unrn.edu.ar', [CLAIM.LIS]: {} });
    expect(db.docs[`course_teachers/c1_${t.uid}`].role).toBe('titular');
    expect(db.docs[`profiles/${t.uid}`].role).toBe('teacher');
    expect((await redeemHandoff(db, t.code)).redirect).toContain('subTab=overview');
    const ta = await launch(db, { [CLAIM.ROLES]: ROLES.ta, sub: '11', email: 'ta@unrn.edu.ar', [CLAIM.LIS]: {} });
    expect(db.docs[`course_teachers/c1_${ta.uid}`].role).toBe('ayudante');
  });

  test('the same (iss, sub) always maps to the same account', async () => {
    const db = seed('approved');
    const first = await launch(db);
    const second = await launch(db, { email: 'otro-mail@gmail.com' });
    expect(second.uid).toBe(first.uid);
    expect(db.docs[`lti_users/${ltiUserDocId(ISS, '19284')}`].uid).toBe('ana');
  });

  test.each([
    ['a replayed state', async (db) => {
      const { state } = await login(db);
      const tok = idToken(db, state);
      await completeLaunch(db, { idToken: tok, state, cookieState: state }, { admin, resolvePlatformKey });
      return completeLaunch(db, { idToken: tok, state, cookieState: state }, { admin, resolvePlatformKey });
    }, 'invalid_state'],
    ['a mismatching nonce', (db) => launch(db, { nonce: 'other' }), 'invalid_nonce'],
    ['another audience', (db) => launch(db, { aud: 'someone-else' }), 'unknown_platform'],
    ['an unregistered deployment', (db) => launch(db, { [CLAIM.DEPLOYMENT_ID]: '99' }), 'invalid_deployment'],
    ['LTI 1.1 style version', (db) => launch(db, { [CLAIM.VERSION]: '1.1' }), 'invalid_claims'],
    ['a role without access', (db) => launch(db, { [CLAIM.ROLES]: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Mentor'] }), 'unsupported_role'],
    ['a token signed by another key', (db) => launch(db, {}, { signer: { privateKey: generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey, kid: 'moodle-1' } }), 'invalid_signature'],
    ['a cookie for another login', (db) => launch(db, {}, { cookie: 'other-state' }), 'invalid_state'],
    ['a course the platform was not registered for', (db) => launch(db, { [CLAIM.CUSTOM]: { courseId: 'c2' }, [CLAIM.CONTEXT]: { id: 'other' } }), 'unlinked_context'],
  ])('rejects %s', async (_label, run, code) => {
    await expect(run(seed('approved'))).rejects.toMatchObject({ code });
  });

  test('a launch without the state cookie still works (third-party cookies blocked)', async () => {
    const db = seed('approved');
    await expect(launch(db, {}, { cookie: null })).resolves.toHaveProperty('code');
  });

  test('deep linking requests open a picker session for instructors only', async () => {
    const db = seed('approved');
    const dl = { [CLAIM.MESSAGE_TYPE]: 'LtiDeepLinkingRequest', [CLAIM.RESOURCE_LINK]: undefined,
      [CLAIM.DL_SETTINGS]: { deep_link_return_url: `${ISS}/mod/lti/contentitem_return.php`, data: 'opaque' } };
    const res = await launch(db, { ...dl, [CLAIM.ROLES]: ROLES.instructor, sub: '10', email: 'prof@unrn.edu.ar', [CLAIM.LIS]: {} });
    const { redirect } = await redeemHandoff(db, res.code);
    const session = new URL(redirect, BASE).searchParams.get('session');
    expect(db.docs[`lti_deep_link_sessions/${session}`]).toMatchObject({ uid: res.uid, data: 'opaque', course_id: 'c1' });
    await expect(launch(db, dl)).rejects.toMatchObject({ code: 'unsupported_role' });
  });
});

test('decodeJwt rejects garbage', () => {
  expect(() => decodeJwt('a.b')).toThrow();
});
