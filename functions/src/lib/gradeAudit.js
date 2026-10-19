/**
 * Auditoría inmutable de calificaciones (mejora 3.10).
 *
 * El trigger `onSubmissionGradeChange` (onDocumentWritten de `submissions`)
 * registra en `audit_logs` todo cambio de nota o feedback, venga de la UI,
 * de una planilla, del endpoint CSV o del autograding. Quien escribe la
 * nota deja en la entrega `graded_by`, `graded_by_name` y `grade_source`;
 * un cambio sin esos datos (p. ej. desde la consola) queda como 'unknown'.
 */
const GRADE_SOURCES = Object.freeze(['manual', 'spreadsheet', 'csv_import', 'autograding', 'unknown']);

/** Campos que cada escritor de notas agrega a la entrega. */
function gradeAttribution(source, actorId = null, actorName = null) {
    return {
        grade_source: GRADE_SOURCES.includes(source) ? source : 'unknown',
        graded_by: actorId,
        graded_by_name: actorName
    };
}

const str = (v) => (v === undefined || v === null ? '' : String(v));

/**
 * Entrada de auditoría para el cambio before -> after de una entrega, o
 * null si no cambió ni la nota ni el feedback.
 */
function gradeChangeAudit(submissionId, before, after) {
    if (!after) return null;
    const prev = before || {};
    const gradeChanged = str(prev.grade) !== str(after.grade);
    const feedbackChanged = str(prev.feedback) !== str(after.feedback);
    if (!gradeChanged && !feedbackChanged) return null;
    return {
        action: 'grade_submission',
        source: GRADE_SOURCES.includes(after.grade_source) ? after.grade_source : 'unknown',
        submission_id: submissionId,
        assignment_id: str(after.assignment_id),
        student_id: str(after.student_id),
        actor_id: after.graded_by || null,
        actor_name: after.graded_by_name || (after.grade_source === 'autograding' ? 'Autograding' : 'Sistema'),
        previous_grade: str(prev.grade),
        new_grade: str(after.grade),
        previous_feedback: str(prev.feedback),
        new_feedback: str(after.feedback)
    };
}

/**
 * Cuerpo del trigger onSubmissionGradeChange: audita el cambio y, si la
 * nota cambió en una entrega lanzada desde Moodle (LTI), la sincroniza.
 */
async function handleSubmissionGradeChange({ db, serverTimestamp, syncGradeToMoodle }, submissionId, before, after) {
    const entry = gradeChangeAudit(submissionId, before, after);
    if (!entry) return { audited: false, synced: false };
    await db.collection('audit_logs').add({ ...entry, created_at: serverTimestamp() });
    const shouldSync = entry.previous_grade !== entry.new_grade && Boolean(after.lti_ags_lineitem);
    if (shouldSync) await syncGradeToMoodle({ id: submissionId, ...after }, after.grade, after.feedback);
    return { audited: true, synced: shouldSync };
}

module.exports = { GRADE_SOURCES, gradeAttribution, gradeChangeAudit, handleSubmissionGradeChange };
