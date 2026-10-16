const {
  enablePeerReview,
  getMyReviewAssignments,
  submitPeerReview,
  getPeerReviewFeedback,
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
    secondRound.forEach((p) => expect(firstRound).not.toContain(p));
  });

  it('returns fewer peers when the course is tiny but never the reviewer alone', () => {
    expect(pickReviewees('x', 'a', ['a'], new Set())).toEqual([]);
    expect(pickReviewees('x', 'missing', ['a', 'b'], new Set())).toEqual([]);
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

describe('Peer review Firestore actions', () => {
  it('enablePeerReview validates assignment, teacher access, and updates rubric', async () => {
    const updateMock = jest.fn().mockResolvedValue(true);
    const db = {
      collection: (name) => {
        if (name === 'assignments') {
          return {
            doc: (id) => ({
              get: async () => id === 'a1'
                ? { exists: true, data: () => ({ course_id: 'c1' }) }
                : { exists: false },
              update: updateMock
            })
          };
        }
        if (name === 'course_teachers') {
          return {
            doc: (id) => ({ get: async () => ({ exists: id === 'c1_t1' }) })
          };
        }
        return {};
      }
    };

    await expect(enablePeerReview({}, { uid: 't1', db })).rejects.toThrow(/assignmentId/i);
    await expect(enablePeerReview({ assignmentId: 'missing' }, { uid: 't1', db })).rejects.toThrow(/no existe/i);
    await expect(enablePeerReview({ assignmentId: 'a1' }, { uid: 'stranger', db })).rejects.toThrow(/acceso/i);

    const res = await enablePeerReview({
      assignmentId: 'a1',
      enabled: true,
      rubric: [{ name: 'Tests', maxPoints: 100 }]
    }, { uid: 't1', db });
    expect(res.success).toBe(true);
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      'peer_review.enabled': true,
      'peer_review.rubric': [{ name: 'Tests', maxPoints: 100 }]
    }));
  });

  it('getMyReviewAssignments returns enabled assignments with pending reviewees', async () => {
    const db = {
      collection: (name) => {
        if (name === 'assignments') {
          return {
            where: () => ({
              get: async () => ({
                docs: [
                  {
                    id: 'a1',
                    data: () => ({
                      title: 'TP 1',
                      due_date: '2026-05-01',
                      peer_review: { enabled: true, rubric: [{ name: 'Calidad', maxPoints: 10 }] }
                    })
                  },
                  {
                    id: 'a2',
                    data: () => ({ title: 'TP 2', peer_review: { enabled: false } })
                  }
                ]
              })
            })
          };
        }
        if (name === 'submissions') {
          return {
            where: () => ({
              get: async () => ({
                docs: [
                  { id: 's1', data: () => ({ student_id: 'stu1', repo_url: 'https://github.com/org/stu1' }) },
                  { id: 's2', data: () => ({ student_id: 'stu2', repo_url: 'https://github.com/org/stu2' }) }
                ]
              })
            })
          };
        }
        if (name === 'peer_reviews') {
          return {
            where: () => ({
              where: () => ({
                get: async () => ({ docs: [] })
              })
            })
          };
        }
        return {};
      }
    };

    await expect(getMyReviewAssignments({}, { uid: 'stu1', db })).rejects.toThrow(/courseId/i);
    const list = await getMyReviewAssignments({ courseId: 'c1' }, { uid: 'stu1', db });
    expect(list).toHaveLength(1);
    expect(list[0].assignment_id).toBe('a1');
    expect(list[0].has_submitted).toBe(true);
    expect(list[0].pending_reviewees).toEqual(['stu2']);
  });

  it('submitPeerReview enforces business rules and stores valid review', async () => {
    let existingReviews = [];
    const addMock = jest.fn().mockResolvedValue({ id: 'rev_1' });
    const db = {
      collection: (name) => {
        if (name === 'assignments') {
          return {
            doc: (id) => ({
              get: async () => {
                if (id === 'disabled') return { exists: true, data: () => ({ peer_review: { enabled: false } }) };
                if (id === 'a1') {
                  return {
                    exists: true,
                    data: () => ({
                      peer_review: {
                        enabled: true,
                        rubric: [{ name: 'Tests', maxPoints: 10 }]
                      }
                    })
                  };
                }
                return { exists: false };
              }
            })
          };
        }
        if (name === 'submissions') {
          return {
            where: () => ({
              get: async () => ({
                docs: [
                  { data: () => ({ student_id: 'stu1' }) },
                  { data: () => ({ student_id: 'stu2' }) }
                ]
              })
            })
          };
        }
        if (name === 'peer_reviews') {
          return {
            where: () => ({
              where: () => ({
                get: async () => ({ docs: existingReviews })
              })
            }),
            add: addMock
          };
        }
        return {};
      }
    };

    await expect(submitPeerReview({}, { uid: 'stu1', db })).rejects.toThrow(/parámetros/i);
    await expect(submitPeerReview({ assignmentId: 'a1', revieweeId: 'stu1', scores: {} }, { uid: 'stu1', db })).rejects.toThrow(/vos mismo/i);
    await expect(submitPeerReview({ assignmentId: 'disabled', revieweeId: 'stu2', scores: {} }, { uid: 'stu1', db })).rejects.toThrow(/no está activa/i);
    await expect(submitPeerReview({ assignmentId: 'a1', revieweeId: 'stu2', scores: { Tests: 15 } }, { uid: 'stu1', db })).rejects.toThrow(/Puntaje inválido/i);
    await expect(submitPeerReview({ assignmentId: 'a1', revieweeId: 'stu2', scores: { Tests: 8 } }, { uid: 'no_sub', db })).rejects.toThrow(/propia resolución/i);
    await expect(submitPeerReview({ assignmentId: 'a1', revieweeId: 'no_sub', scores: { Tests: 8 } }, { uid: 'stu1', db })).rejects.toThrow(/no tiene entrega/i);

    const ok = await submitPeerReview({
      assignmentId: 'a1',
      revieweeId: 'stu2',
      scores: { Tests: 9 },
      comment: 'Buen trabajo'
    }, { uid: 'stu1', db });
    expect(ok).toEqual({ success: true, reviewId: 'rev_1' });

    existingReviews = [{ data: () => ({ reviewee_id: 'stu2' }) }];
    await expect(submitPeerReview({ assignmentId: 'a1', revieweeId: 'stu2', scores: { Tests: 9 } }, { uid: 'stu1', db })).rejects.toThrow(/Ya revisaste/i);
  });

  it('getPeerReviewFeedback aggregates averages for student and teacher views', async () => {
    const db = {
      collection: (name) => {
        if (name === 'assignments') {
          return {
            doc: () => ({
              get: async () => ({
                exists: true,
                data: () => ({
                  course_id: 'c1',
                  peer_review: { rubric: [{ name: 'Tests', maxPoints: 10 }] }
                })
              })
            })
          };
        }
        if (name === 'peer_reviews') {
          return {
            where: () => ({
              get: async () => ({
                docs: [
                  { id: 'r1', data: () => ({ reviewee_id: 'stu1', scores: { Tests: 8 }, comment: 'Claro' }) },
                  { id: 'r2', data: () => ({ reviewee_id: 'stu1', scores: { Tests: 10 }, comment: '' }) },
                  { id: 'r3', data: () => ({ reviewee_id: 'stu2', scores: { Tests: 6 }, comment: 'Faltan tests' }) }
                ]
              })
            })
          };
        }
        if (name === 'course_teachers') {
          return {
            doc: (id) => ({ get: async () => ({ exists: id === 'c1_t1' }) })
          };
        }
        return {};
      }
    };

    const studentRes = await getPeerReviewFeedback({ assignmentId: 'a1' }, { uid: 'stu1', db });
    expect(studentRes.is_teacher_view).toBe(false);
    expect(studentRes.feedback).toHaveLength(1);
    expect(studentRes.feedback[0].averages.Tests).toBe(9);
    expect(studentRes.feedback[0].review_count).toBe(2);

    const teacherRes = await getPeerReviewFeedback({ assignmentId: 'a1' }, { uid: 't1', db });
    expect(teacherRes.is_teacher_view).toBe(true);
    expect(teacherRes.feedback).toHaveLength(2);
  });
});

