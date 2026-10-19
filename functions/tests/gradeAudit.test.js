const { gradeAttribution, gradeChangeAudit } = require('../src/lib/gradeAudit');

describe('gradeAudit', () => {
  const base = { assignment_id: 'a1', student_id: 's1', grade: '7', feedback: 'Bien' };

  it('ignores writes that do not change grade or feedback', () => {
    expect(gradeChangeAudit('sub1', base, { ...base, repo_url: 'x' })).toBeNull();
    expect(gradeChangeAudit('sub1', base, null)).toBeNull();
  });

  it('records manual grading with the actor', () => {
    const after = { ...base, grade: '9', ...gradeAttribution('manual', 't1', 'Kakashi') };
    expect(gradeChangeAudit('sub1', base, after)).toEqual({
      action: 'grade_submission', source: 'manual', submission_id: 'sub1', assignment_id: 'a1', student_id: 's1',
      actor_id: 't1', actor_name: 'Kakashi', previous_grade: '7', new_grade: '9', previous_feedback: 'Bien', new_feedback: 'Bien'
    });
  });

  it('records bulk imports and autograding, including submissions created with a grade', () => {
    expect(gradeChangeAudit('sub2', null, { ...base, ...gradeAttribution('autograding') })).toMatchObject({
      source: 'autograding', actor_id: null, actor_name: 'Autograding', previous_grade: '', new_grade: '7'
    });
    expect(gradeChangeAudit('sub1', base, { ...base, feedback: 'Revisar', ...gradeAttribution('csv_import', null, 'Importación CSV') }))
      .toMatchObject({ source: 'csv_import', actor_name: 'Importación CSV', new_feedback: 'Revisar' });
  });

  it('labels changes without attribution as unknown', () => {
    expect(gradeChangeAudit('sub1', base, { ...base, grade: '4' })).toMatchObject({ source: 'unknown', actor_name: 'Sistema' });
    expect(gradeAttribution('nope').grade_source).toBe('unknown');
  });
});

describe('handleSubmissionGradeChange (mejoras 3.10 y 3.19)', () => {
  const { handleSubmissionGradeChange } = require('../src/lib/gradeAudit');
  const deps = () => {
    const added = [];
    return {
      added,
      db: { collection: () => ({ add: async (d) => added.push(d) }) },
      serverTimestamp: () => 'TS',
      syncGradeToMoodle: jest.fn().mockResolvedValue()
    };
  };
  const lti = { lti_ags_lineitem: 'https://moodle.example/mod/lti/services.php/2/lineitems/7/lineitem', lti_user_sub: '42' };

  it('audits and syncs LTI submissions when the grade changes, whatever the source', async () => {
    const d = deps();
    const r = await handleSubmissionGradeChange(d, 's1', { grade: '5', ...lti }, { grade: '8', ...lti, grade_source: 'csv_import' });
    expect(r).toEqual({ audited: true, synced: true });
    expect(d.added[0]).toMatchObject({ source: 'csv_import', new_grade: '8', created_at: 'TS' });
    expect(d.syncGradeToMoodle).toHaveBeenCalledWith(expect.objectContaining({ id: 's1' }), '8', undefined);
  });

  it('does not sync feedback-only changes or non-LTI submissions', async () => {
    const d = deps();
    expect(await handleSubmissionGradeChange(d, 's1', { grade: '8', feedback: 'a', ...lti }, { grade: '8', feedback: 'b', ...lti })).toEqual({ audited: true, synced: false });
    expect(await handleSubmissionGradeChange(d, 's2', { grade: '5' }, { grade: '9' })).toEqual({ audited: true, synced: false });
    expect(await handleSubmissionGradeChange(d, 's3', { grade: '9' }, { grade: '9' })).toEqual({ audited: false, synced: false });
    expect(d.syncGradeToMoodle).not.toHaveBeenCalled();
  });
});
