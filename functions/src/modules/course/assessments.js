/**
 * Parciales y recuperatorios en colección propia (plan F2.2).
 *
 *   assessments/{id}                         { course_id, kind, label, recovers, date, commission, archived }
 *   assessment_grades/{assessmentId}_{uid}   { course_id, assessment_id, student_id, grade, absent, feedback }
 *
 * Solo backend: las reglas de Firestore niegan todo acceso de cliente.
 */
const { HttpsError } = require('firebase-functions/v2/https');
const { normalizeGrade, normalizeFeedback } = require('../../lib/grades');
const { isCourseStaff } = require('../../authz');
const { publishSingleGrade } = require('../integrations/lti');
const { assertCanEditStudents, staffCommissionScope, outOfScope } = require('../../lib/courseGuards');

const NUMERIC_RE = /^\d+(\.\d+)?$/;

async function getAssessmentOrThrow(db, assessmentId) {
    const snap = await db.collection('assessments').doc(assessmentId).get();
    if (!snap.exists) throw new HttpsError('not-found', 'No se encontró la evaluación.');
    return { id: snap.id, ...snap.data() };
}

async function assertRecoversParcial(db, courseId, recoversId) {
    const target = await getAssessmentOrThrow(db, recoversId);
    if (target.course_id !== courseId || target.kind !== 'parcial') {
        throw new HttpsError('invalid-argument', 'El recuperatorio debe apuntar a un parcial de esta cursada.');
    }
}

async function actorName(context) {
    const profile = context.getMyProfile ? await context.getMyProfile() : null;
    return profile ? profile.full_name || profile.email || '' : '';
}

/** Notas para parciales: numéricas 0–10 o vacío; "ausente" va como bandera. */
function normalizeAssessmentGrade(raw) {
    const normalized = normalizeGrade(raw);
    if (!normalized.ok) return normalized;
    if (normalized.value !== '' && !NUMERIC_RE.test(normalized.value)) {
        return { ok: false, error: 'La nota de un parcial debe ser numérica (0 a 10). Para ausentes usá la marca "Ausente".' };
    }
    return normalized;
}

async function getAssessments(payload, context) {
    const { uid, db, getMyProfile } = context;
    const { courseId } = payload;
    const profile = getMyProfile ? await getMyProfile() : null;
    const staff = (profile && profile.role === 'admin') || await isCourseStaff(db, courseId, uid);

    const assessmentsSnap = await db.collection('assessments').where('course_id', '==', courseId).get();
    const assessments = assessmentsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((a) => !a.archived)
        .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.label).localeCompare(String(b.label)));

    let gradesQuery = db.collection('assessment_grades').where('course_id', '==', courseId);
    if (!staff) gradesQuery = gradesQuery.where('student_id', '==', uid);
    const grades = (await gradesQuery.get()).docs.map((d) => {
        const g = d.data();
        return {
            id: d.id,
            assessment_id: g.assessment_id,
            student_id: g.student_id,
            grade: g.grade,
            absent: Boolean(g.absent),
            feedback: g.feedback || '',
            ...(staff ? { graded_by_name: g.graded_by_name || '' } : {}),
        };
    });
    return { assessments, grades, canGrade: staff };
}

async function createAssessment(payload, context) {
    const { uid, db, admin } = context;
    const { courseId, kind, label, recovers, date, commission } = payload;
    if (kind === 'recuperatorio') {
        if (!recovers) throw new HttpsError('invalid-argument', 'Indicá qué parcial recupera.');
        await assertRecoversParcial(db, courseId, recovers);
    }
    const ref = await db.collection('assessments').add({
        course_id: courseId,
        kind,
        label: label.trim(),
        recovers: kind === 'recuperatorio' ? recovers : null,
        date: date || null,
        commission: commission || null,
        archived: false,
        created_by: uid,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { id: ref.id };
}

async function updateAssessment(payload, context) {
    const { db } = context;
    const assessment = await getAssessmentOrThrow(db, payload.assessmentId);
    const data = { ...payload.data };
    if (data.label !== undefined) data.label = data.label.trim();
    if (data.recovers !== undefined) {
        if (assessment.kind !== 'recuperatorio') delete data.recovers;
        else if (!data.recovers) throw new HttpsError('invalid-argument', 'Un recuperatorio tiene que indicar qué parcial recupera.');
        else await assertRecoversParcial(db, assessment.course_id, data.recovers);
    }
    if (Object.keys(data).length === 0) throw new HttpsError('invalid-argument', 'No hay cambios para guardar.');
    await db.collection('assessments').doc(assessment.id).update(data);
    return { success: true };
}

async function archiveAssessment(payload, context) {
    const { db } = context;
    const assessment = await getAssessmentOrThrow(db, payload.assessmentId);
    await db.collection('assessments').doc(assessment.id).update({ archived: true });
    return { success: true };
}

async function writeGrade(context, assessment, studentId, { grade, absent, feedback }, name) {
    const { uid, db, admin } = context;
    const ref = db.collection('assessment_grades').doc(`${assessment.id}_${studentId}`);
    const previous = await ref.get();
    const record = {
        course_id: assessment.course_id,
        assessment_id: assessment.id,
        student_id: studentId,
        grade: absent ? '' : grade,
        absent: Boolean(absent),
        feedback,
        graded_by: uid,
        graded_by_name: name,
        graded_at: admin.firestore.FieldValue.serverTimestamp(),
    };
    await ref.set(record);
    await db.collection('audit_logs').add({
        action: 'grade_assessment',
        course_id: assessment.course_id,
        assessment_id: assessment.id,
        student_id: studentId,
        actor_id: uid,
        actor_name: name,
        previous_grade: previous.exists ? previous.data().grade || '' : '',
        previous_absent: previous.exists ? Boolean(previous.data().absent) : false,
        new_grade: record.grade,
        new_absent: record.absent,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
}

async function isRosterStudent(db, courseId, studentId) {
    const snap = await db.collection('course_roster').doc(`${courseId}_${studentId}`).get();
    return snap.exists && snap.data().status !== 'removed';
}

async function gradeAssessment(payload, context) {
    const { db } = context;
    const assessment = await getAssessmentOrThrow(db, payload.assessmentId);
    if (assessment.archived) throw new HttpsError('failed-precondition', 'La evaluación está archivada.');
    if (!(await isRosterStudent(db, assessment.course_id, payload.studentId))) {
        throw new HttpsError('invalid-argument', 'El estudiante no pertenece a esta cursada.');
    }
    await assertCanEditStudents(db, assessment.course_id, context.uid, [payload.studentId]);
    const normalized = normalizeAssessmentGrade(payload.grade);
    if (!normalized.ok) throw new HttpsError('invalid-argument', normalized.error);
    const feedback = normalizeFeedback(payload.feedback);
    await writeGrade(context, assessment, payload.studentId, {
        grade: normalized.value,
        absent: payload.absent,
        feedback,
    }, await actorName(context));
    // LTI 1.3 AGS: publica la nota si el curso está vinculado a Moodle.
    await publishSingleGrade(db, {
        assessmentId: assessment.id, studentId: payload.studentId, grade: payload.absent ? '' : normalized.value, feedback,
    });
    return { success: true, grade: payload.absent ? '' : normalized.value };
}

/** Carga masiva desde planilla: filas por matrícula o por uid. */
async function importAssessmentGrades(payload, context) {
    const { db } = context;
    const assessment = await getAssessmentOrThrow(db, payload.assessmentId);
    if (assessment.archived) throw new HttpsError('failed-precondition', 'La evaluación está archivada.');
    await assertCanEditStudents(db, assessment.course_id, context.uid, []);
    const scope = await staffCommissionScope(db, assessment.course_id, context.uid);

    const rosterSnap = await db.collection('course_roster').where('course_id', '==', assessment.course_id).get();
    const enrolled = new Set(rosterSnap.docs.map((d) => d.data()).filter((r) => r.status !== 'removed').map((r) => r.student_id));
    const byMatricula = {};
    for (const studentId of enrolled) {
        const p = await db.collection('profiles').doc(studentId).get();
        const matricula = p.exists ? String(p.data().matricula_unrn || '').trim().toUpperCase() : '';
        if (matricula) byMatricula[matricula] = studentId;
    }

    const name = await actorName(context);
    const rejected = [];
    let updated = 0;
    for (const [index, row] of payload.rows.entries()) {
        const studentId = row.studentId || byMatricula[String(row.matricula || '').trim().toUpperCase()];
        const label = row.matricula || row.studentId || `fila ${index + 1}`;
        if (!studentId || !enrolled.has(studentId)) {
            rejected.push({ row: label, reason: 'No está en el padrón de la cursada.' });
            continue;
        }
        if ((await outOfScope(db, assessment.course_id, scope, [studentId])).length > 0) {
            rejected.push({ row: label, reason: 'Pertenece a una comisión que no tenés asignada.' });
            continue;
        }
        const normalized = normalizeAssessmentGrade(row.grade);
        if (!normalized.ok) {
            rejected.push({ row: label, reason: normalized.error });
            continue;
        }
        await writeGrade(context, assessment, studentId, { grade: normalized.value, absent: row.absent, feedback: '' }, name);
        updated++;
    }
    return { updated, rejected };
}

module.exports = {
    getAssessments,
    createAssessment,
    updateAssessment,
    archiveAssessment,
    gradeAssessment,
    importAssessmentGrades,
    normalizeAssessmentGrade,
};
