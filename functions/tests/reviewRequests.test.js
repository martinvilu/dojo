const reviews = require('../src/modules/course/reviewRequests');
const { seed, call } = require('./helpers/courseSeed');

describe('review requests', () => {
  test('students open and see only their own; staff replies notify', async () => {
    const db = seed();
    const { id } = await call(db, 's1', 'createReviewRequest', reviews.createReviewRequest,
      { courseId: 'c1', kind: 'attendance', refId: 'class_2', refLabel: 'Asistencia clase 2', message: 'Estuve presente' });
    await call(db, 's2', 'createReviewRequest', reviews.createReviewRequest, { courseId: 'c1', kind: 'other', refLabel: 'General', message: 'Consulta' });
    await expect(call(db, 't1', 'createReviewRequest', reviews.createReviewRequest, { courseId: 'c1', kind: 'other', refLabel: 'x', message: 'abc' }))
      .rejects.toMatchObject({ code: 'failed-precondition' });

    expect((await call(db, 's1', 'getReviewRequests', reviews.getReviewRequests, { courseId: 'c1' })).map((r) => r.id)).toEqual([id]);
    expect(await call(db, 't1', 'getReviewRequests', reviews.getReviewRequests, { courseId: 'c1' })).toHaveLength(2);

    await expect(call(db, 's2', 'replyReviewRequest', reviews.replyReviewRequest, { requestId: id, message: 'yo también' })).rejects.toMatchObject({ code: 'permission-denied' });
    const res = await call(db, 't1', 'replyReviewRequest', reviews.replyReviewRequest, { requestId: id, message: 'Corregido', close: true });
    expect(res.status).toBe('closed');
    expect(db.docs[`review_requests/${id}`].messages.map((m) => m.role)).toEqual(['student', 'staff']);
    expect(Object.values(db.docs).some((d) => d.student_id === 's1' && /respondió tu consulta/.test(d.message || ''))).toBe(true);
  });
});
