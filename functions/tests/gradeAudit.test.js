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
