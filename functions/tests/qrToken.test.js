const q = require('../src/lib/qrToken');

// Vector compartido con tests/unit/qrToken.test.ts: ambas implementaciones
// (backend y navegador del docente) deben derivar el mismo código.
const SECRET = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';

describe('qrToken', () => {
  it('derives the shared test vector', () => {
    expect(q.qrCodeForStep(SECRET, 123456)).toBe('R44U94');
  });

  it('uses only unambiguous characters', () => {
    for (let step = 0; step < 200; step++) {
      expect(q.qrCodeForStep(SECRET, step)).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/);
    }
  });

  it('accepts the current and the previous step only', () => {
    const now = 1_700_000_000_000;
    const step = q.qrStepAt(now);
    expect(q.isValidQrCode(SECRET, q.qrCodeForStep(SECRET, step), now)).toBe(true);
    expect(q.isValidQrCode(SECRET, q.qrCodeForStep(SECRET, step - 1).toLowerCase(), now)).toBe(true);
    expect(q.isValidQrCode(SECRET, q.qrCodeForStep(SECRET, step - 2), now)).toBe(false);
    expect(q.isValidQrCode(SECRET, q.qrCodeForStep(SECRET, step + 1), now)).toBe(false);
    expect(q.isValidQrCode(SECRET, 'ABC', now)).toBe(false);
    expect(q.isValidQrCode(SECRET, null, now)).toBe(false);
  });
});
