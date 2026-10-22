const { generateSecret, currentCode, verifyCode, codeForCounter, counterAt, STEP_SECONDS, ALPHABET } = require('../src/lib/totp');

describe('QR rotating codes', () => {
  const secret = generateSecret();
  const t0 = 1_800_000_000_000;

  test('codes are 6 unambiguous characters and deterministic per step', () => {
    const { code } = currentCode(secret, t0);
    expect(code).toHaveLength(6);
    for (const ch of code) expect(ALPHABET).toContain(ch);
    expect(currentCode(secret, t0).code).toBe(code);
    expect(ALPHABET).not.toMatch(/[0O1IL]/);
  });

  test('code rotates every step and reports the seconds left', () => {
    const start = counterAt(t0) * STEP_SECONDS * 1000;
    expect(currentCode(secret, start).expiresInSeconds).toBe(STEP_SECONDS);
    expect(currentCode(secret, start + 14_000).expiresInSeconds).toBe(1);
    expect(currentCode(secret, start).code).not.toBe(currentCode(secret, start + STEP_SECONDS * 1000).code);
  });

  test('accepts the current and previous step only, never future ones', () => {
    const c = counterAt(t0);
    expect(verifyCode(secret, codeForCounter(secret, c), t0)).toBe(true);
    expect(verifyCode(secret, codeForCounter(secret, c - 1), t0)).toBe(true);
    expect(verifyCode(secret, codeForCounter(secret, c - 2), t0)).toBe(false);
    expect(verifyCode(secret, codeForCounter(secret, c + 1), t0)).toBe(false);
  });

  test('is case and whitespace tolerant but rejects other secrets and bad input', () => {
    const { code } = currentCode(secret, t0);
    expect(verifyCode(secret, ` ${code.slice(0, 3)}-${code.slice(3).toLowerCase()} `, t0)).toBe(true);
    expect(verifyCode(generateSecret(), code, t0)).toBe(false);
    expect(verifyCode(secret, '', t0)).toBe(false);
    expect(verifyCode(secret, 'ABCDEFG', t0)).toBe(false);
    expect(verifyCode(secret, null, t0)).toBe(false);
  });
});
