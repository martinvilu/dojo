const { HttpsError } = require('firebase-functions/v2/https');
const { reportError, isExpected, init } = require('../src/lib/observability');

const fakeSentry = () => {
  const sent = [];
  const scope = { tags: {}, user: null, setTag(k, v) { this.tags[k] = v; }, setUser(u) { this.user = u; } };
  return { sent, scope, withScope: (fn) => fn(scope), captureException: (e) => sent.push(e) };
};

describe('observability', () => {
  test('without a DSN nothing is initialized or reported', () => {
    expect(init({})).toBeNull();
    expect(reportError(new Error('boom'), { action: 'x' })).toBe(false);
  });

  test('expected HttpsErrors are not reported; unexpected errors are, with action and uid only', () => {
    const client = fakeSentry();
    expect(isExpected(new HttpsError('permission-denied', 'no'))).toBe(true);
    expect(reportError(new HttpsError('invalid-argument', 'bad'), { action: 'a' }, client)).toBe(false);
    expect(reportError(new HttpsError('internal', 'db down'), { action: 'gradeSubmission', uid: 'u1' }, client)).toBe(true);
    expect(reportError(new TypeError('x is undefined'), { action: 'closeCourse', uid: 'u2' }, client)).toBe(true);
    expect(client.sent).toHaveLength(2);
    expect(client.scope.tags.action).toBe('closeCourse');
    expect(client.scope.user).toEqual({ id: 'u2' });
  });
});
