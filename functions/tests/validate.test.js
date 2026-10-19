const { isSafeDocId, validatePayload } = require('../src/lib/validate');

describe('validatePayload', () => {
  it('accepts regular payloads and normalizes missing ones', () => {
    expect(validatePayload({ courseId: 'abc123', classNumber: 3, data: { class_instances: [{ topic: 'Git' }] } })).toBeTruthy();
    expect(validatePayload(undefined)).toEqual({});
    expect(validatePayload({ moodleCourseId: 142, courseIds: ['a', 'b'] })).toBeTruthy();
  });

  it('rejects ids that would address another path or are not strings', () => {
    for (const bad of ['c1/active_qr/current', '..', '__secret__', { $gt: '' }, ['c1'], 'x'.repeat(257), 'a\nb']) {
      expect(() => validatePayload({ courseId: bad })).toThrow(/Identificador inválido/);
    }
    expect(() => validatePayload({ targetUid: 'u/1' })).toThrow();
    expect(() => validatePayload({ course_id: { a: 1 } })).toThrow();
  });

  it('validates courseIds lists', () => {
    expect(() => validatePayload({ courseIds: 'c1' })).toThrow(/Lista de cursos/);
    expect(() => validatePayload({ courseIds: ['ok', 'mal/id'] })).toThrow(/Lista de cursos/);
    expect(() => validatePayload({ courseIds: Array(201).fill('c') })).toThrow(/Lista de cursos/);
  });

  it('bounds size and depth', () => {
    expect(() => validatePayload({ big: 'x'.repeat(600 * 1024) })).toThrow(/demasiado grande/);
    let deep = {};
    const root = deep;
    for (let i = 0; i < 25; i++) { deep.n = {}; deep = deep.n; }
    expect(() => validatePayload(root)).toThrow(/anidamiento/);
    expect(() => validatePayload([1, 2])).toThrow(/objeto/);
  });

  it('isSafeDocId', () => {
    expect(isSafeDocId('assign_01-x')).toBe(true);
    expect(isSafeDocId('')).toBe(false);
    expect(isSafeDocId(NaN)).toBe(false);
  });
});

describe('normalizeEmail', () => {
  const { normalizeEmail } = require('../src/lib/validate');
  it('normalizes valid emails and rejects the rest', () => {
    expect(normalizeEmail('  Naruto@UNRN.edu.ar ')).toBe('naruto@unrn.edu.ar');
    for (const bad of ['sin-arroba', 'a@b', { $ne: null }, 'a b@c.d', 'x'.repeat(250) + '@a.com', null]) {
      expect(normalizeEmail(bad)).toBeNull();
    }
  });
});
