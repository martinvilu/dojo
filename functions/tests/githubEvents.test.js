const { createHmac } = require('node:crypto');
const { handleGithubEvent, transitionFor } = require('../src/modules/github/events');
const { seed } = require('./helpers/courseSeed');

const NOW = Date.parse('2026-06-15T12:00:00-03:00');

describe('GitHub events webhook', () => {
  const SECRET = 'whsec';
  const send = async (db, event, body, { delivery = `d-${Math.random().toString(36).slice(2)}`, secret = SECRET, nowMs = NOW } = {}) => {
    const raw = Buffer.from(JSON.stringify(body));
    const req = {
      method: 'POST', rawBody: raw, body,
      headers: { 'x-github-event': event, 'x-github-delivery': delivery, 'x-hub-signature-256': `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}` },
    };
    let statusCode = 200; let payload;
    const res = { status: (c) => { statusCode = c; return res; }, json: (p) => { payload = p; return res; }, send: (p) => { payload = p; return res; } };
    await handleGithubEvent(req, res, { secret: SECRET, db, nowMs });
    return { statusCode, payload };
  };
  const repo = { repository: { full_name: 'unrn-prog1/TP1-ana' } };
  const withSub = () => {
    const db = seed();
    db.docs['submissions/sub1'] = { assignment_id: 'a1', student_id: 's1', repo_url: 'https://github.com/unrn-prog1/TP1-ana', grade: '' };
    return db;
  };

  test('rejects bad signatures and deduplicates deliveries', async () => {
    const db = withSub();
    expect((await send(db, 'pull_request', { action: 'opened', ...repo }, { secret: 'wrong' })).statusCode).toBe(401);
    expect((await send(db, 'pull_request', { action: 'opened', ...repo }, { delivery: 'same' })).statusCode).toBe(200);
    expect((await send(db, 'pull_request', { action: 'opened', ...repo }, { delivery: 'same' })).payload).toEqual({ duplicate: true });
  });

  test('PR opened submits (late after the deadline), review cycle and resubmission are audited', async () => {
    const db = withSub();
    await send(db, 'pull_request', { action: 'opened', pull_request: { html_url: 'https://github.com/x/pull/1', number: 1 }, ...repo });
    expect(db.docs['submissions/sub1']).toMatchObject({ status: 'submitted', pr_number: 1, late: true });

    await send(db, 'pull_request_review', { action: 'submitted', review: { state: 'CHANGES_REQUESTED', body: 'Falta el README', user: { login: 'ta' } }, ...repo });
    expect(db.docs['submissions/sub1']).toMatchObject({ status: 'changes_requested', last_review: { body: 'Falta el README', by: 'ta' } });

    await send(db, 'push', { ...repo });
    expect(db.docs['submissions/sub1'].status).toBe('submitted');
    expect(db.docs['submissions/sub1'].resubmitted_at).toBeInstanceOf(Date);

    await send(db, 'pull_request_review', { action: 'submitted', review: { state: 'approved', user: { login: 'ta' } }, ...repo });
    expect(db.docs['submissions/sub1'].status).toBe('approved');
    const audit = Object.values(db.docs).filter((d) => d.action === 'github_submission_status').map((d) => d.new_status);
    expect(audit).toEqual(['submitted', 'changes_requested', 'submitted', 'approved']);
  });

  test('ignores repositories without a submission and unrelated actions', async () => {
    const db = withSub();
    expect((await send(db, 'pull_request', { action: 'opened', repository: { full_name: 'other/repo' } })).statusCode).toBe(202);
    expect(transitionFor('pull_request', { action: 'closed' }, {}, NOW)).toBeNull();
    expect(transitionFor('pull_request', { action: 'opened' }, { status: 'approved' }, NOW)).toBeNull();
  });
});
