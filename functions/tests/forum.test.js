const forum = require('../src/modules/course/forum');
const { seed, call } = require('./helpers/courseSeed');

describe('official forum solutions', () => {
  test('one solution per class, author notified once, no XP writes', async () => {
    const db = seed();
    await expect(call(db, 's1', 'markCommentSolution', forum.markCommentSolution, { courseId: 'c1', commentId: 'k1', isSolution: true }))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await call(db, 't1', 'markCommentSolution', forum.markCommentSolution, { courseId: 'c1', commentId: 'k1', isSolution: true });
    expect(db.docs['courses/c1/class_comments/k1']).toMatchObject({ is_best_answer: true, is_solution: true });
    expect(db.docs['courses/c1/class_comments/k2'].is_best_answer).toBe(false);
    expect(Object.keys(db.docs).some((k) => k.includes('xp_logs'))).toBe(false);

    await call(db, 't1', 'markCommentSolution', forum.markCommentSolution, { courseId: 'c1', commentId: 'k1', isSolution: false });
    await call(db, 't1', 'markCommentSolution', forum.markCommentSolution, { courseId: 'c1', commentId: 'k1', isSolution: true });
    const notices = Object.values(db.docs).filter((d) => d.student_id === 's2' && /solución oficial/.test(d.message || ''));
    expect(notices).toHaveLength(1);
  });
});
