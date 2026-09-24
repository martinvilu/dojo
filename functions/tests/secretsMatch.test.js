const { matchesSecret } = require('../src/lib/secrets');

describe('matchesSecret', () => {
  test('accepts a token equal to any of the valid secrets', () => {
    expect(matchesSecret('ABC123', 'ABC123')).toBe(true);
    expect(matchesSecret('CAL', 'SYNC', 'CAL')).toBe(true);
  });

  test('rejects different, prefix or differently sized tokens', () => {
    expect(matchesSecret('ABC124', 'ABC123')).toBe(false);
    expect(matchesSecret('ABC', 'ABC123')).toBe(false);
    expect(matchesSecret('ABC1234', 'ABC123')).toBe(false);
  });

  test('never validates against empty or missing secrets', () => {
    expect(matchesSecret('', '')).toBe(false);
    expect(matchesSecret('x', undefined, null, '')).toBe(false);
    expect(matchesSecret(undefined, 'ABC')).toBe(false);
    expect(matchesSecret(['ABC'], 'ABC')).toBe(false);
  });
});
