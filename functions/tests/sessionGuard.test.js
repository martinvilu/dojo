const { assertSessionNotRevoked, forgetSession, CACHE_MS } = require('../src/lib/sessionGuard');

describe('sessionGuard (mejora 3.29)', () => {
  beforeEach(() => forgetSession('u1'));

  it('rejects tokens issued before the revocation time', async () => {
    const auth = { getUser: jest.fn().mockResolvedValue({ tokensValidAfterTime: new Date(2_000_000 * 1000).toUTCString() }) };
    await expect(assertSessionNotRevoked(auth, { uid: 'u1', auth_time: 1_999_999 }, { now: 1 }))
      .rejects.toMatchObject({ code: 'unauthenticated', details: { code: 'AUTH_SESSION_REVOKED' } });
    await expect(assertSessionNotRevoked(auth, { uid: 'u1', auth_time: 2_000_001 }, { now: 2 })).resolves.toBeUndefined();
  });

  it('caches the lookup and refreshes it after the cache window', async () => {
    const auth = { getUser: jest.fn().mockResolvedValue({ tokensValidAfterTime: null }) };
    await assertSessionNotRevoked(auth, { uid: 'u1', auth_time: 10 }, { now: 0 });
    await assertSessionNotRevoked(auth, { uid: 'u1', auth_time: 10 }, { now: CACHE_MS - 1 });
    expect(auth.getUser).toHaveBeenCalledTimes(1);
    await assertSessionNotRevoked(auth, { uid: 'u1', auth_time: 10 }, { now: CACHE_MS + 1 });
    expect(auth.getUser).toHaveBeenCalledTimes(2);
  });

  it('fails open when Auth is unavailable', async () => {
    const warn = jest.fn();
    const auth = { getUser: jest.fn().mockRejectedValue(new Error('unavailable')) };
    await expect(assertSessionNotRevoked(auth, { uid: 'u1', auth_time: 10 }, { logger: { warn }, now: 0 })).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });
});
