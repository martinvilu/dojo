const { generateKeyPairSync, createPublicKey, createVerify } = require('node:crypto');
const { postScore, scoresUrl, resetTokenCache } = require('../src/lib/ltiAgs');
const { consumeLtiLaunch, agsFieldsForSubmission } = require('../src/modules/integrations/lti');

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' });
const env = { LTI_CLIENT_ID: 'client-1', LTI_PLATFORM_TOKEN_URL: 'https://moodle.unrn.edu.ar/mod/lti/token.php', LTI_TOOL_PRIVATE_KEY: PEM };
const LINEITEM = 'https://moodle.unrn.edu.ar/mod/lti/services.php/2/lineitems/7/lineitem?type_id=3';

describe('AGS grade passback (mejora 3.12)', () => {
  beforeEach(() => resetTokenCache());

  it('requests a token with a signed client assertion and posts the score', async () => {
    const calls = [];
    const fetchImpl = jest.fn(async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith('token.php')) return { ok: true, status: 200, json: async () => ({ access_token: 'T1', expires_in: 3600 }) };
      return { ok: true, status: 200 };
    });
    const status = await postScore({ lineitem: LINEITEM, userId: '42', score: 8.5, comment: 'Bien' }, { env, fetchImpl, now: 1_800_000_000_000 });
    expect(status).toBe(200);

    const form = new URLSearchParams(calls[0].init.body);
    expect(form.get('grant_type')).toBe('client_credentials');
    expect(form.get('scope')).toBe('https://purl.imsglobal.org/spec/lti-ags/scope/score');
    const [h, p, sig] = form.get('client_assertion').split('.');
    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${h}.${p}`);
    expect(verifier.verify(createPublicKey(privateKey), Buffer.from(sig, 'base64url'))).toBe(true);
    expect(JSON.parse(Buffer.from(p, 'base64url'))).toMatchObject({ iss: 'client-1', sub: 'client-1', aud: env.LTI_PLATFORM_TOKEN_URL });

    expect(calls[1].url).toBe('https://moodle.unrn.edu.ar/mod/lti/services.php/2/lineitems/7/lineitem/scores?type_id=3');
    expect(calls[1].init.headers).toMatchObject({ 'Content-Type': 'application/vnd.ims.lis.v1.score+json', Authorization: 'Bearer T1' });
    expect(JSON.parse(calls[1].init.body)).toMatchObject({ userId: '42', scoreGiven: 8.5, scoreMaximum: 10, gradingProgress: 'FullyGraded' });

    // El token se reutiliza mientras no vence.
    await postScore({ lineitem: LINEITEM, userId: '43', score: 7 }, { env, fetchImpl, now: 1_800_000_060_000 });
    expect(calls.filter((c) => c.url.endsWith('token.php'))).toHaveLength(1);
  });

  it('refuses unsafe URLs and missing configuration', async () => {
    const fetchImpl = jest.fn();
    await expect(postScore({ lineitem: 'http://10.0.0.1/lineitem', userId: '1', score: 5 }, { env, fetchImpl })).rejects.toThrow(/no permitida/);
    await expect(postScore({ lineitem: LINEITEM, userId: '1', score: 5 }, { env: {}, fetchImpl })).rejects.toThrow(/no configurado/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('builds scores URLs', () => {
    expect(scoresUrl('https://m.example/lineitems/7/lineitem/')).toBe('https://m.example/lineitems/7/lineitem/scores');
  });
});

function launchDb(docs) {
  const writes = [];
  return {
    writes,
    collection: (name) => ({
      doc: (id) => ({
        get: async () => ({ exists: Boolean(docs[`${name}/${id}`]), data: () => docs[`${name}/${id}`], ref: { update: async (d) => { writes.push([`${name}/${id}`, d]); docs[`${name}/${id}`] = { ...docs[`${name}/${id}`], ...d }; } } }),
        set: async (d) => writes.push([`${name}/${id}`, d])
      })
    })
  };
}
const admin = { firestore: { FieldValue: { arrayUnion: (v) => ({ union: v }) } } };
const LAUNCH = {
  messageType: 'LtiResourceLinkRequest', issuer: 'https://moodle.unrn.edu.ar', sub: '42', email: 'ana@unrn.edu.ar',
  courseId: 'c1', assignmentId: 'a1', targetModule: 'assignments', isInstructor: false,
  ags: { lineitem: LINEITEM }, consumed_by: null, expires_at: { toMillis: () => Date.now() + 60000 }
};

describe('consumeLtiLaunch', () => {
  it('links the verified launch to the caller once and returns navigation', async () => {
    const db = launchDb({ 'lti_launches/L1': { ...LAUNCH } });
    const res = await consumeLtiLaunch({ launchId: 'L1' }, { uid: 'u1', db, admin, authUser: { email: 'ana@unrn.edu.ar' } });
    expect(res).toMatchObject({ courseId: 'c1', assignmentId: 'a1', hasGradeService: true, emailMatches: true });
    expect(db.writes).toContainEqual(['profiles/u1', { lti_identities: { union: 'https://moodle.unrn.edu.ar|42' } }]);
    // Otro usuario no puede canjear el mismo launch.
    await expect(consumeLtiLaunch({ launchId: 'L1' }, { uid: 'u2', db, admin })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects expired, unknown and deep linking launches', async () => {
    const db = launchDb({
      'lti_launches/old': { ...LAUNCH, expires_at: { toMillis: () => Date.now() - 1 } },
      'lti_launches/dl': { ...LAUNCH, messageType: 'LtiDeepLinkingRequest' }
    });
    for (const id of ['old', 'dl', 'nope']) {
      await expect(consumeLtiLaunch({ launchId: id }, { uid: 'u1', db, admin })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    }
  });

  it('gives AGS fields only for the caller own launch', async () => {
    const db = launchDb({ 'lti_launches/L1': { ...LAUNCH, consumed_by: 'u1' } });
    expect(await agsFieldsForSubmission(db, 'u1', 'L1')).toEqual({ lti_issuer: LAUNCH.issuer, lti_user_sub: '42', lti_ags_lineitem: LINEITEM });
    expect(await agsFieldsForSubmission(db, 'u2', 'L1')).toEqual({});
    expect(await agsFieldsForSubmission(db, 'u1', undefined)).toEqual({});
  });
});
