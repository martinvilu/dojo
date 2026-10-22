/**
 * Rango Ninja calculado desde los datos (plan F0.2).
 *
 * Antes el QR y el foro escribían en `profiles/{uid}/xp_logs` y la tarjeta
 * del alumno recalculaba por su cuenta: dos fuentes que se desfasaban. Ahora
 * la bitácora y el total salen de `lib/xp.js` sobre asistencia, entregas,
 * notas de parciales y foro; no se escribe XP en ningún lado.
 */
const { loadCourseAcademicData } = require('../../lib/academic/loader');
const { computeXp, xpEvents } = require('../../lib/xp');
const { isCourseStaff } = require('../../authz');

function toIso(value) {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Insumos de `lib/xp` de un alumno en un curso. */
async function loadStudentXpInput(db, courseId, studentId) {
    const [data, commentsSnap] = await Promise.all([
        loadCourseAcademicData(db, courseId, { studentId }),
        db.collection('courses').doc(courseId).collection('class_comments').where('user_id', '==', studentId).get(),
    ]);
    const commission = data.students[0] ? data.students[0].commission : null;
    const assessments = new Map(data.assessments
        .filter((a) => !a.commission || a.commission === commission)
        .map((a) => [a.id, a]));
    const assessmentGrades = Object.values(data.gradesByStudent[studentId] || {})
        .filter((g) => assessments.has(g.assessment_id))
        .map((g) => ({ ...g, label: assessments.get(g.assessment_id).label }));
    return {
        studentId,
        attendance: data.attendance,
        submissions: Object.values(data.submissionsByStudent[studentId] || {}),
        assessmentGrades,
        comments: commentsSnap.docs.map((d) => d.data()),
        assignmentTitles: Object.fromEntries(data.assignments.map((a) => [a.id, a.title || 'TP'])),
        courseName: data.course.name || '',
    };
}

/** Cursos donde el alumno figura en el padrón (no bajas). */
async function studentCourseIds(db, uid) {
    const snap = await db.collection('course_roster').where('student_id', '==', uid).get();
    return snap.docs.map((d) => d.data()).filter((r) => r.status !== 'baja' && r.course_id).map((r) => r.course_id);
}

async function getMyXp(payload, context) {
    const { db, uid } = context;
    if (await isCourseStaff(db, payload.courseId, uid)) return null;
    const input = await loadStudentXpInput(db, payload.courseId, uid);
    return computeXp(input);
}

/** Bitácora de XP del perfil: todos los cursos del alumno, más recientes primero. */
async function getXpLogs(payload, context) {
    const { db, uid } = context;
    const logs = [];
    for (const courseId of await studentCourseIds(db, uid)) {
        let input;
        try {
            input = await loadStudentXpInput(db, courseId, uid);
        } catch {
            continue; // curso borrado
        }
        xpEvents(input).forEach((e, i) => logs.push({
            id: `${courseId}_${i}`,
            action: e.action,
            description: input.courseName ? `${e.description} · ${input.courseName}` : e.description,
            points: e.points,
            timestamp: toIso(e.at),
        }));
    }
    return logs.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
}

module.exports = { getMyXp, getXpLogs, loadStudentXpInput };
