const { randomBytes } = require('node:crypto');
const { encryptSecret, decryptSecret, isEncrypted, keyId, CONTEXTS } = require('../src/lib/encryption');

describe('credential encryption at rest', () => {
  const key = randomBytes(32).toString('hex');
  const env = { DOJO_ENCRYPTION_KEY: key };
  const ctx = CONTEXTS.courseGithubToken('c1');

  test('round-trips and never stores the plaintext', () => {
    const stored = encryptSecret('ghp_secret', ctx, env);
    expect(isEncrypted(stored)).toBe(true);
    expect(stored).not.toContain('ghp_secret');
    expect(decryptSecret(stored, ctx, env)).toBe('ghp_secret');
    expect(encryptSecret('ghp_secret', ctx, env)).not.toBe(stored); // random IV
  });

  test('binds the ciphertext to its document and field (AAD)', () => {
    const stored = encryptSecret('ghp_secret', ctx, env);
    expect(() => decryptSecret(stored, CONTEXTS.courseGithubToken('c2'), env)).toThrow();
  });

  test('detects tampering', () => {
    const stored = encryptSecret('ghp_secret', ctx, env);
    const parts = stored.split(':');
    parts[5] = Buffer.from('ghp_other!').toString('base64url');
    expect(() => decryptSecret(parts.join(':'), ctx, env)).toThrow();
  });

  test('decrypts with the previous key during a rotation', () => {
    const stored = encryptSecret('ghp_secret', ctx, env);
    const rotated = { DOJO_ENCRYPTION_KEY: randomBytes(32).toString('hex'), DOJO_ENCRYPTION_KEY_PREVIOUS: key };
    expect(decryptSecret(stored, ctx, rotated)).toBe('ghp_secret');
    expect(stored.split(':')[2]).toBe(keyId(Buffer.from(key, 'hex')));
    expect(() => decryptSecret(stored, ctx, { DOJO_ENCRYPTION_KEY: randomBytes(32).toString('hex') })).toThrow(/clave/);
  });

  test('legacy plaintext values are still readable; empty values stay empty', () => {
    expect(decryptSecret('ghp_legacy', ctx, env)).toBe('ghp_legacy');
    expect(decryptSecret('', ctx, env)).toBeNull();
    expect(encryptSecret('', ctx, env)).toBeNull();
  });

  test('refuses to store credentials without a configured key', () => {
    expect(() => encryptSecret('ghp_secret', ctx, {})).toThrow(/DOJO_ENCRYPTION_KEY/);
    expect(() => encryptSecret('x', ctx, { DOJO_ENCRYPTION_KEY: 'short' })).toThrow(/32 bytes/);
  });
});

describe('lib/admin (emulator compatibility)', () => {
  const { withFirestoreStatics } = require('../src/lib/admin');
  test('restores firestore statics lost by a bound proxy', () => {
    const real = require('firebase-admin');
    // Lo que hace el emulador: admin.firestore enlazado, sin estáticos.
    const emulated = new Proxy(real, { get: (t, k) => (k === 'firestore' ? t.firestore.bind(t) : t[k]) });
    expect(emulated.firestore.FieldValue).toBeUndefined();
    const fixed = withFirestoreStatics(emulated);
    expect(typeof fixed.firestore.FieldValue.serverTimestamp).toBe('function');
    expect(typeof fixed.firestore.Timestamp.now).toBe('function');
    expect(withFirestoreStatics(real)).toBe(real);
  });
});
