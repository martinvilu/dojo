const { notifyBestAnswer } = require('../src/modules/notifications/forum');

function deps(docs) {
  const added = [];
  return {
    added,
    db: {
      collection: (name) => ({
        doc: (id) => ({ get: async () => ({ exists: Boolean(docs[`${name}/${id}`]), data: () => docs[`${name}/${id}`] }) }),
        add: async (d) => added.push(d)
      })
    },
    serverTimestamp: () => 'TS'
  };
}

describe('notifyBestAnswer (mejora 3.25)', () => {
  const docs = { 'profiles/s1': { notification_pref: 'daily_summary' }, 'courses/c1': { name: 'Algoritmos' } };

  it('notifies the author when the message becomes the solution', async () => {
    const d = deps(docs);
    expect(await notifyBestAnswer(d, 'c1', { is_best_answer: false, user_id: 's1' }, { is_best_answer: true, user_id: 's1', classNumber: 4 })).toBe(true);
    expect(d.added[0]).toMatchObject({ student_id: 's1', type: 'best_answer', read: false, is_daily_pending: true, created_at: 'TS' });
    expect(d.added[0].message).toContain('clase 4 en Algoritmos');
  });

  it('ignores unmarking, unchanged marks and unknown authors', async () => {
    const d = deps(docs);
    expect(await notifyBestAnswer(d, 'c1', { is_best_answer: true, user_id: 's1' }, { is_best_answer: false, user_id: 's1' })).toBe(false);
    expect(await notifyBestAnswer(d, 'c1', { is_best_answer: true, user_id: 's1' }, { is_best_answer: true, user_id: 's1' })).toBe(false);
    expect(await notifyBestAnswer(d, 'c1', {}, { is_best_answer: true, user_id: 'ghost' })).toBe(false);
    expect(d.added).toHaveLength(0);
  });
});
