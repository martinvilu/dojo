const { encryptSecret, decryptSecret, isEncrypted, courseGithubToken } = require('../src/lib/secretBox');

const KEY = Buffer.alloc(32, 7).toString('base64');

describe('secretBox (mejora 3.13)', () => {
  const env = { TOKEN_ENCRYPTION_KEY: KEY };

  it('round-trips with AES-256-GCM and random IVs', () => {
    const a = encryptSecret('ghp_secreto', { env });
    const b = encryptSecret('ghp_secreto', { env });
    expect(isEncrypted(a)).toBe(true);
    expect(a).not.toBe(b);
    expect(a).not.toContain('ghp_secreto');
    expect(decryptSecret(a, { env })).toBe('ghp_secreto');
  });

  it('detects tampering', () => {
    const enc = encryptSecret('ghp_secreto', { env });
    const parts = enc.split(':');
    parts[4] = Buffer.from('otro').toString('base64url');
    expect(() => decryptSecret(parts.join(':'), { env })).toThrow();
  });

  it('keeps legacy plaintext readable and skips encryption without a key', () => {
    expect(decryptSecret('ghp_legacy', { env })).toBe('ghp_legacy');
    const warn = jest.fn();
    expect(encryptSecret('ghp_x', { env: {}, logger: { warn } })).toBe('ghp_x');
    expect(warn).toHaveBeenCalled();
    expect(() => decryptSecret(encryptSecret('x', { env }), { env: {} })).toThrow(/TOKEN_ENCRYPTION_KEY/);
  });

  it('rejects malformed keys', () => {
    expect(() => encryptSecret('x', { env: { TOKEN_ENCRYPTION_KEY: 'corta' } })).toThrow(/32 bytes/);
  });

  it('courseGithubToken decrypts course tokens', () => {
    process.env.TOKEN_ENCRYPTION_KEY = KEY;
    try {
      expect(courseGithubToken({ github_token: encryptSecret('ghp_curso') })).toBe('ghp_curso');
      expect(courseGithubToken({})).toBeNull();
    } finally {
      delete process.env.TOKEN_ENCRYPTION_KEY;
    }
  });
});
