const { ACTION_MODULES } = require('../src/actions');
const { ACTION_SCHEMAS } = require('../src/schemas');
const { validatePayload } = require('../src/lib/validation');

const validate = (action, payload) => validatePayload(ACTION_SCHEMAS, action, payload);
const invalid = { code: 'invalid-argument' };

describe('payload schemas', () => {
  test('every registered action declares a schema, and no schema is orphaned', () => {
    expect(Object.keys(ACTION_MODULES).filter((a) => !ACTION_SCHEMAS[a])).toEqual([]);
    expect(Object.keys(ACTION_SCHEMAS).filter((a) => !ACTION_MODULES[a])).toEqual([]);
  });

  test('actions without a schema are rejected (fail closed)', () => {
    expect(() => validate('notARealAction', {})).toThrow(expect.objectContaining(invalid));
  });

  test('a missing payload is treated as an empty object', () => {
    expect(validate('getProfile', undefined)).toEqual({});
  });

  test('rejects wrong types for known fields but keeps unknown aliases', () => {
    expect(() => validate('getCourseDetails', { courseId: { $gt: '' } })).toThrow(expect.objectContaining(invalid));
    expect(() => validate('getCourseDetails', {})).toThrow(/courseId/);
    expect(validate('createAssignment', { course_id: 'c1', title: 'TP1', extra: 1 })).toMatchObject({ course_id: 'c1', extra: 1 });
  });

  test('bounds the size of free text', () => {
    expect(() => validate('postStudyGroupMessage', { groupId: 'g1', content: 'x'.repeat(5001) })).toThrow(/5000/);
  });

  test('updateCourseSettings only accepts whitelisted fields', () => {
    expect(validate('updateCourseSettings', { courseId: 'c1', data: { cover_text: 'Hola', duration_weeks: 16 } }))
      .toMatchObject({ data: { cover_text: 'Hola', duration_weeks: 16 } });
    // Antes un docente podía sobrescribir cualquier campo del curso.
    for (const field of ['sync_secret', 'calendar_secret', 'teacher_invite_code', 'archived', 'grading_rules']) {
      expect(() => validate('updateCourseSettings', { courseId: 'c1', data: { [field]: 'x' } })).toThrow(expect.objectContaining(invalid));
    }
  });

  test('admin profile edits cannot write arbitrary fields', () => {
    expect(validate('updateUserProfile', { userId: 'u1', data: { role: 'teacher', commission: 'A' } })).toBeTruthy();
    expect(() => validate('updateUserProfile', { userId: 'u1', data: { role: 'superuser' } })).toThrow();
    expect(() => validate('updateUserProfile', { userId: 'u1', data: { xp: 9999 } })).toThrow();
  });

  test('QR attendance accepts numeric strings for the class and nullable coordinates', () => {
    expect(validate('submitQrAttendance', { courseId: 'c1', classNumber: '3', token: 'ABC234', lat: null, lng: null })).toBeTruthy();
    expect(() => validate('submitQrAttendance', { courseId: 'c1', classNumber: 'tres', token: 'ABC234' })).toThrow();
  });
});
