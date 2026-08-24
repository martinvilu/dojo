const {
  pickReviewees,
  validateRubric,
  PEERS_PER_REVIEWER
} = require('../src/modules/github/peerreview');

const AID = 'assignment1';

function submitters(n) {
  return Array.from({ length: n }, (_, i) => `student_${i}`);
}

describe('Peer review pairing', () => {
  it('assigns up to PEERS_PER_REVIEWER distinct peers', () => {
    const peers = pickReviewees(AID, 'student_0', submitters(10), new Set());
    expect(peers.length).toBe(PEERS_PER_REVIEWER);
    expect(new Set(peers).size).toBe(PEERS_PER_REVIEWER);
    expect(peers).not.toContain('student_0');
  });

  it('never includes the reviewer and only actual submitters', () => {
    const pool = ['a', 'b', 'c'];
    const peers = pickReviewees('x', 'a', pool, new Set());
    expect(peers.every((p) => pool.includes(p) && p !== 'a')).toBe(true);
  });

  it('skips already reviewed classmates', () => {
    const pool = ['a', 'b', 'c', 'd', 'e'];
    const firstRound = pickReviewees('x', 'a', pool, new Set());
    expect(firstRound.length).toBe(2);

    const secondRound = pickReviewees('x', 'a', pool, new Set(firstRound));
    // No overlap with the first round.
    secondRound.forEach((p) => expect(firstRound).not.toContain(p));
  });

  it('returns fewer peers when the course is tiny but never the reviewer alone', () => {
    expect(pickReviewees('x', 'a', ['a'], new Set())).toEqual([]);
    const pair = pickReviewees('x', 'a', ['a', 'b'], new Set());
    expect(pair).toEqual(['b']);
  });

  it('is deterministic for the same assignment+student', () => {
    const pool = submitters(8);
    const a = pickReviewees(AID, 'student_3', pool, new Set());
    const b = pickReviewees(AID, 'student_3', [...pool].reverse(), new Set());
    expect(a).toEqual(b);
  });

  it('differs across assignments so pairs rotate', () => {
    const pool = submitters(6);
    const one = pickReviewees('assignment1', 'student_1', pool, new Set());
    const two = pickReviewees('assignment2', 'student_1', pool, new Set());
    expect(one.join()).not.toEqual(two.join());
  });
});

describe('Peer review rubric validation', () => {
  it('normalizes names and keeps max points', () => {
    const rubric = validateRubric([
      { name: ' Correctitud ', maxPoints: 50 },
      { name: 'Estilo', maxPoints: '20' }
    ]);
    expect(rubric).toEqual([
      { name: 'Correctitud', maxPoints: 50 },
      { name: 'Estilo', maxPoints: 20 }
    ]);
  });

  it('rejects empty, oversized, unnamed or out-of-range criteria', () => {
    expect(() => validateRubric([])).toThrow(/entre 1 y 8/);
    expect(() => validateRubric(new Array(9).fill({ name: 'x', maxPoints: 5 }))).toThrow(/entre 1 y 8/);
    expect(() => validateRubric([{ name: '', maxPoints: 5 }])).toThrow(/nombre/);
    expect(() => validateRubric([{ name: 'x', maxPoints: 101 }])).toThrow(/inválido/i);
    expect(() => validateRubric([{ name: 'x', maxPoints: -1 }])).toThrow(/inválido/i);
  });
});
