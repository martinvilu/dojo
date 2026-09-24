const { normalizeGrade, normalizeFeedback, MAX_FEEDBACK_LENGTH } = require('../src/lib/grades');

describe('normalizeGrade', () => {
  test.each([
    ['9', '9'],
    [9, '9'],
    ['7,5', '7.5'],
    ['7.50', '7.5'],
    [' 10 ', '10'],
    ['0', '0'],
    ['6.666', '6.67'],
    ['', ''],
    [null, ''],
    [undefined, ''],
    ['Aprobado', 'Aprobado'],
    ['  Promocionado   con  nota ', 'Promocionado con nota']
  ])('accepts %p as %p', (input, expected) => {
    expect(normalizeGrade(input)).toEqual({ ok: true, value: expected });
  });

  test.each(['15', '-1', '10.01', '9/10', 'NaN', 'Infinity', '1e1', '<b>10</b>', 'A+', {}, [], true])(
    'rejects %p',
    (input) => {
      const res = normalizeGrade(input);
      expect(res.ok).toBe(false);
      expect(res.error).toContain('entre 0 y 10');
    }
  );
});

describe('normalizeFeedback', () => {
  test('coerces to string and caps the length', () => {
    expect(normalizeFeedback(undefined)).toBe('');
    expect(normalizeFeedback(42)).toBe('42');
    expect(normalizeFeedback('x'.repeat(MAX_FEEDBACK_LENGTH + 10))).toHaveLength(MAX_FEEDBACK_LENGTH);
  });
});

describe('gradeToOutcomeScore', () => {
  const { gradeToOutcomeScore } = require('../src/lib/grades');

  test('maps the 0..10 scale to 0..1 without treating low grades as fractions', () => {
    expect(gradeToOutcomeScore('10')).toBe(1);
    expect(gradeToOutcomeScore('7,5')).toBe(0.75);
    expect(gradeToOutcomeScore('1')).toBe(0.1);
    expect(gradeToOutcomeScore('0')).toBe(0);
  });

  test('returns null for conceptual, empty or invalid grades', () => {
    expect(gradeToOutcomeScore('Aprobado')).toBeNull();
    expect(gradeToOutcomeScore('')).toBeNull();
    expect(gradeToOutcomeScore('15')).toBeNull();
  });
});

describe('gradeSubmission validation', () => {
  const { gradeSubmission } = require('../src/modules/github/assignments');

  function context() {
    const updates = [];
    const doc = (data) => ({
      get: async () => ({ exists: true, data: () => data }),
      update: async (d) => updates.push(d)
    });
    const db = {
      collection: (name) => ({
        doc: () => doc(name === 'profiles' ? { role: 'teacher', full_name: 'Prof' } : { assignment_id: 'a1', student_id: 's1' }),
        add: async () => ({ id: 'log' })
      })
    };
    return { uid: 't1', db, admin: { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } }, updates };
  }

  test('rejects impossible grades with invalid-argument', async () => {
    const ctx = context();
    await expect(gradeSubmission({ submissionId: 'sub1', grade: '15' }, ctx)).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(ctx.updates).toHaveLength(0);
  });

  test('stores the normalized grade', async () => {
    const ctx = context();
    await gradeSubmission({ submissionId: 'sub1', grade: '8,25', feedback: 'Bien' }, ctx);
    expect(ctx.updates[0]).toMatchObject({ grade: '8.25', feedback: 'Bien' });
  });
});
