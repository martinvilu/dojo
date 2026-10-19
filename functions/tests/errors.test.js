const { HttpsError } = require('firebase-functions/v2/https');
const { ERROR_CODES, DojoError, dojoError, toHttpsError } = require('../src/lib/errors');

describe('errors', () => {
  it('maps every semantic code to a valid HttpsError status', () => {
    for (const code of Object.keys(ERROR_CODES)) {
      const e = toHttpsError(dojoError(code, 'msg'));
      expect(e).toBeInstanceOf(HttpsError);
      expect(e.code).toBe(ERROR_CODES[code]);
      expect(e.details).toEqual({ code });
    }
  });

  it('keeps the user-facing message and extra details', () => {
    const e = toHttpsError(dojoError('COURSE_NOT_FOUND', 'Curso no encontrado', { courseId: 'c1' }));
    expect(e.message).toBe('Curso no encontrado');
    expect(e.details).toEqual({ code: 'COURSE_NOT_FOUND', courseId: 'c1' });
  });

  it('adds a generic code to HttpsErrors thrown without one', () => {
    const e = toHttpsError(new HttpsError('permission-denied', 'No sos docente'));
    expect(e.details).toEqual({ code: 'FORBIDDEN' });
    const kept = new HttpsError('resource-exhausted', 'x', { code: 'RATE_LIMITED', retryAfterSeconds: 3 });
    expect(toHttpsError(kept)).toBe(kept);
  });

  it('reports unknown errors as INTERNAL and unknown codes as INTERNAL', () => {
    expect(toHttpsError(new Error('boom'))).toMatchObject({ code: 'internal', message: 'boom', details: { code: 'INTERNAL' } });
    expect(new DojoError('NOPE', 'x').code).toBe('INTERNAL');
  });
});
