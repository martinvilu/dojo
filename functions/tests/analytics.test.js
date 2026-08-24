const { computeRiskScore, riskLevel, WEIGHTS } = require('../src/modules/course/analytics');

describe('Dropout risk scoring', () => {
  it('returns a perfect score for an ideal student', () => {
    const { score, factors } = computeRiskScore({
      attendanceRatio: 1, pendingRatio: 0, lateRatio: 0, hasForumActivity: true
    });
    expect(score).toBe(0);
    expect(factors).toEqual({ attendance: 0, pending: 0, late: 0, forum: 0 });
  });

  it('weights factors according to the documented maximums', () => {
    const { factors } = computeRiskScore({
      attendanceRatio: 0, pendingRatio: 1, lateRatio: 1, hasForumActivity: false
    });
    expect(factors.attendance).toBe(WEIGHTS.ATTENDANCE);
    expect(factors.pending).toBe(WEIGHTS.PENDING);
    expect(factors.late).toBe(WEIGHTS.LATE);
    expect(factors.forum).toBe(WEIGHTS.FORUM);
  });

  it('caps the total score at 100', () => {
    const { score } = computeRiskScore({
      attendanceRatio: -3, pendingRatio: 7, lateRatio: 2, hasForumActivity: false
    });
    expect(score).toBe(100);
  });

  it('floors negative inputs to zero penalty', () => {
    const { score } = computeRiskScore({
      attendanceRatio: 1, pendingRatio: -1, lateRatio: -1, hasForumActivity: true
    });
    expect(score).toBe(0);
  });

  it('treats missing ratios as neutral-perfect (early term)', () => {
    // undefined -> Number()||0 -> 0 penalty; forum activity keeps it at 0
    const { score } = computeRiskScore({ hasForumActivity: true });
    expect(score).toBe(0);
  });

  it('classifies ALTO from score 60', () => {
    expect(riskLevel(60)).toBe('ALTO');
    expect(riskLevel(100)).toBe('ALTO');
  });

  it('classifies MEDIO between 35 and 59', () => {
    expect(riskLevel(35)).toBe('MEDIO');
    expect(riskLevel(59)).toBe('MEDIO');
  });

  it('classifies BAJO below 35', () => {
    expect(riskLevel(34)).toBe('BAJO');
    expect(riskLevel(0)).toBe('BAJO');
  });

  it('matches the documented worked example', () => {
    // 75% asistencia, la mitad de las tareas pendientes, nada tarde, sin foro
    const { score } = computeRiskScore({
      attendanceRatio: 0.75, pendingRatio: 0.5, lateRatio: 0, hasForumActivity: false
    });
    expect(score).toBe(
      Math.round(WEIGHTS.ATTENDANCE * 0.25) +
      Math.round(WEIGHTS.PENDING * 0.5) +
      WEIGHTS.FORUM
    );
  });
});
