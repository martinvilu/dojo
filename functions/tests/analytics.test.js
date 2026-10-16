const {
  computeRiskScore,
  riskLevel,
  getDropoutRiskAnalysis,
  WEIGHTS
} = require('../src/modules/course/analytics');

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

describe('getDropoutRiskAnalysis', () => {
  it('validates courseId, teacher access, and course existence', async () => {
    await expect(getDropoutRiskAnalysis({}, { uid: 't1', db: {} })).rejects.toThrow(/courseId/i);

    const dbNoAccess = {
      collection: () => ({
        doc: () => ({ get: async () => ({ exists: false }) })
      })
    };
    await expect(getDropoutRiskAnalysis({ courseId: 'c1' }, { uid: 't1', db: dbNoAccess })).rejects.toThrow(/acceso/i);

    const dbNoCourse = {
      collection: (name) => ({
        doc: () => ({ get: async () => ({ exists: name === 'course_teachers' }) })
      })
    };
    await expect(getDropoutRiskAnalysis({ courseId: 'c1' }, { uid: 't1', db: dbNoCourse })).rejects.toThrow(/no encontrado/i);
  });

  it('aggregates attendance, assignments, late submissions, and forum activity sorted by risk descending', async () => {
    const dueIso = '2026-04-01T00:00:00.000Z';
    const lateMs = new Date('2026-04-05T00:00:00.000Z').getTime();
    const onTimeMs = new Date('2026-03-30T00:00:00.000Z').getTime();

    const db = {
      collection: (name) => {
        if (name === 'course_teachers') {
          return { doc: () => ({ get: async () => ({ exists: true }) }) };
        }
        if (name === 'courses') {
          return {
            doc: () => ({
              get: async () => ({
                exists: true,
                data: () => ({ class_instances: [{ id: 'cl1' }, { id: 'cl2' }] })
              }),
              collection: (sub) => {
                if (sub === 'attendance') {
                  return {
                    get: async () => ({
                      docs: [
                        { data: () => ({ records: { s_good: 'present', s_risk: 'absent' } }) }
                      ]
                    })
                  };
                }
                if (sub === 'class_comments') {
                  return {
                    get: async () => ({
                      docs: [
                        { data: () => ({ user_id: 's_good', is_best_answer: true }) },
                        { data: () => ({ user_id: null }) }
                      ]
                    })
                  };
                }
                return { get: async () => ({ docs: [] }) };
              }
            })
          };
        }
        if (name === 'assignments') {
          return {
            where: () => ({
              get: async () => ({
                size: 2,
                docs: [
                  { id: 'a1', data: () => ({ due_date: dueIso }) },
                  { id: 'a2', data: () => ({ due_date: dueIso }) }
                ]
              })
            })
          };
        }
        if (name === 'attendance') {
          return {
            where: () => ({
              get: async () => ({
                docs: [
                  { data: () => ({ student_id: 's_good', status: 'late' }) },
                  { data: () => ({ student_id: null }) }
                ]
              })
            })
          };
        }
        if (name === 'course_roster') {
          return {
            where: () => ({
              where: () => ({
                get: async () => ({
                  docs: [
                    { data: () => ({ student_id: 's_good' }) },
                    { data: () => ({ student_id: 's_risk' }) }
                  ]
                })
              })
            })
          };
        }
        if (name === 'profiles') {
          return {
            doc: (id) => ({
              get: async () => (
                id === 's_good'
                  ? { exists: true, data: () => ({ full_name: 'Buen Estudiante', email: 'good@unrn.edu.ar', github_user: 'gooddev' }) }
                  : { exists: false }
              )
            })
          };
        }
        if (name === 'submissions') {
          return {
            where: (_f, _op, sid) => ({
              get: async () => ({
                docs: sid === 's_good'
                  ? [
                      { id: 'sub1', data: () => ({ assignment_id: 'a1', created_at: { toMillis: () => onTimeMs } }) },
                      { id: 'sub2', data: () => ({ assignment_id: 'a2', created_at: { toMillis: () => lateMs } }) },
                      { id: 'sub_other', data: () => ({ assignment_id: 'other_course_a' }) }
                    ]
                  : []
              })
            })
          };
        }
        return {};
      }
    };

    const report = await getDropoutRiskAnalysis({ courseId: 'c1' }, { uid: 't1', db });
    expect(report.total_classes).toBe(2);
    expect(report.total_assignments).toBe(2);
    expect(report.students).toHaveLength(2);
    // Highest risk first
    expect(report.students[0].student_id).toBe('s_risk');
    expect(report.students[0].level).toBe('ALTO');
    expect(report.students[1].student_id).toBe('s_good');
    expect(report.students[1].metrics.late).toBe(1);
    expect(report.students[1].metrics.forum_best_answers).toBe(1);
  });
});

