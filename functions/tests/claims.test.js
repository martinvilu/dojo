const { syncRoleClaim } = require('../src/lib/claims');

function fakeAuth(claims) {
  return {
    claims,
    getUser: jest.fn(async () => ({ customClaims: claims })),
    setCustomUserClaims: jest.fn(async (uid, c) => { claims = c; }),
    revokeRefreshTokens: jest.fn(async () => {})
  };
}

describe('syncRoleClaim (mejora 3.34)', () => {
  it('sets the role claim preserving other claims', async () => {
    const auth = fakeAuth({ beta: true });
    expect(await syncRoleClaim(auth, 'u1', 'teacher')).toBe(true);
    expect(auth.setCustomUserClaims).toHaveBeenCalledWith('u1', { beta: true, role: 'teacher' });
    expect(auth.revokeRefreshTokens).not.toHaveBeenCalled();
  });

  it('is a no-op when the claim is already right or the role is invalid', async () => {
    const auth = fakeAuth({ role: 'student' });
    expect(await syncRoleClaim(auth, 'u1', 'student')).toBe(false);
    expect(await syncRoleClaim(auth, 'u1', 'root')).toBe(false);
    expect(auth.setCustomUserClaims).not.toHaveBeenCalled();
  });

  it('revokes sessions when the role is lowered', async () => {
    const auth = fakeAuth({ role: 'admin' });
    await syncRoleClaim(auth, 'u1', 'student');
    expect(auth.revokeRefreshTokens).toHaveBeenCalledWith('u1');
    const auth2 = fakeAuth({});
    await syncRoleClaim(auth2, 'u2', 'student', { previousRole: 'teacher' });
    expect(auth2.revokeRefreshTokens).toHaveBeenCalled();
  });
});

describe('updateUserProfile whitelist', () => {
  const { updateUserProfile } = require('../src/modules/course/admin');
  const ctx = () => {
    const updates = [];
    const auth = fakeAuth({ role: 'student' });
    return {
      updates, auth,
      admin: { auth: () => auth },
      db: { collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => ({ role: 'student' }) }), update: async (d) => updates.push(d) }) }) }
    };
  };

  it('accepts editable fields and syncs the claim on role change', async () => {
    const c = ctx();
    await updateUserProfile({ userId: 'u1', data: { full_name: 'Ana', role: 'teacher' } }, c);
    expect(c.updates).toEqual([{ full_name: 'Ana', role: 'teacher' }]);
    expect(c.auth.setCustomUserClaims).toHaveBeenCalledWith('u1', { role: 'teacher' });
  });

  it('rejects non-editable fields and invalid values', async () => {
    await expect(updateUserProfile({ userId: 'u1', data: { xp_total: 9999 } }, ctx())).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    await expect(updateUserProfile({ userId: 'u1', data: { role: 'root' } }, ctx())).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    await expect(updateUserProfile({ userId: 'u1', data: { account_status: 'banned' } }, ctx())).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
  });
});
