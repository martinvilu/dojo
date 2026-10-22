/**
 * Carga desde Firestore (Admin SDK) los datos que necesita el motor de
 * condición académica y lo corre para todo el padrón o para un alumno.
 *
 * Solo depende del cliente de Firestore que recibe, así que lo usan tanto la
 * callable `api` como las rutas de Next (export CSV). Lee cada colección una
 * vez por curso en lugar de una consulta por alumno.
 */
const { computeAcademicCondition } = require('./condition');
const { toMs } = require('./deadlines');

const IN_QUERY_LIMIT = 30;

function chunk(list, size) {
    const out = [];
    for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    return out;
}

function docsOf(snap) {
    return snap ? snap.docs.map((d) => ({ id: d.id, ...d.data() })) : [];
}

/** Con varias entregas para la misma tarea, gana la calificada más reciente. */
function preferSubmission(current, candidate) {
    if (!current) return candidate;
    const graded = (s) => s.grade !== undefined && s.grade !== null && String(s.grade).trim() !== '';
    if (graded(candidate) !== graded(current)) return graded(candidate) ? candidate : current;
    const at = (s) => toMs(s.graded_at) || toMs(s.submitted_at) || toMs(s.created_at) || 0;
    return at(candidate) > at(current) ? candidate : current;
}

function commissionOf(profile, courseId) {
    if (!profile) return null;
    return (profile.commissions && profile.commissions[courseId]) || null;
}

async function getProfiles(db, ids) {
    const out = {};
    if (ids.length === 0) return out;
    if (typeof db.getAll === 'function') {
        for (const part of chunk(ids, 100)) {
            const snaps = await db.getAll(...part.map((id) => db.collection('profiles').doc(id)));
            for (const snap of snaps) if (snap.exists) out[snap.id] = snap.data();
        }
        return out;
    }
    await Promise.all(ids.map(async (id) => {
        const snap = await db.collection('profiles').doc(id).get();
        if (snap.exists) out[id] = snap.data();
    }));
    return out;
}

function byStudent(docs, key = 'student_id') {
    const out = {};
    for (const d of docs) (out[d[key]] ||= []).push(d);
    return out;
}

/**
 * @param {object} db         Firestore Admin
 * @param {string} courseId
 * @param {{ studentId?: string }} [opts]  limitar la carga a un alumno
 */
async function loadCourseAcademicData(db, courseId, { studentId } = {}) {
    const courseSnap = await db.collection('courses').doc(courseId).get();
    if (!courseSnap.exists) throw new Error('Curso no encontrado.');
    const course = courseSnap.data();

    const scoped = (collection) => {
        let q = db.collection(collection).where('course_id', '==', courseId);
        if (studentId) q = q.where('student_id', '==', studentId);
        return q.get();
    };

    const [rosterSnap, attendanceSnap, assignmentsSnap, assessmentsSnap, gradesSnap, exceptionsSnap] = await Promise.all([
        studentId
            ? db.collection('course_roster').doc(`${courseId}_${studentId}`).get()
            : db.collection('course_roster').where('course_id', '==', courseId).get(),
        db.collection('courses').doc(courseId).collection('attendance').get(),
        db.collection('assignments').where('course_id', '==', courseId).get(),
        db.collection('assessments').where('course_id', '==', courseId).get(),
        scoped('assessment_grades'),
        scoped('course_exceptions'),
    ]);

    const rosterDocs = studentId
        ? [{ student_id: studentId, status: rosterSnap.exists ? rosterSnap.data().status : 'approved' }]
        : docsOf(rosterSnap);

    const assignments = docsOf(assignmentsSnap);
    const assignmentIds = assignments.map((a) => a.id);
    const submissions = [];
    for (const part of chunk(assignmentIds, IN_QUERY_LIMIT)) {
        let q = db.collection('submissions').where('assignment_id', 'in', part);
        if (studentId) q = q.where('student_id', '==', studentId);
        submissions.push(...docsOf(await q.get()));
    }

    const studentIds = [...new Set(rosterDocs.map((r) => r.student_id).filter(Boolean))];
    const profiles = await getProfiles(db, studentIds);

    const submissionsByStudent = {};
    for (const sub of submissions) {
        const mine = (submissionsByStudent[sub.student_id] ||= {});
        mine[sub.assignment_id] = preferSubmission(mine[sub.assignment_id], sub);
    }
    const gradesByStudent = {};
    for (const g of docsOf(gradesSnap)) {
        (gradesByStudent[g.student_id] ||= {})[g.assessment_id] = g;
    }

    return {
        courseId,
        course,
        students: rosterDocs.map((r) => ({
            id: r.student_id,
            profile: profiles[r.student_id] || null,
            rosterStatus: r.status || 'approved',
            commission: commissionOf(profiles[r.student_id], courseId),
        })),
        attendance: docsOf(attendanceSnap).map((a) => ({
            classNumber: a.classNumber !== undefined ? a.classNumber : Number(String(a.id).replace('class_', '')),
            records: a.records || {},
            updated_at: a.updated_at || null,
        })),
        assignments,
        assessments: docsOf(assessmentsSnap),
        submissionsByStudent,
        gradesByStudent,
        exceptionsByStudent: byStudent(docsOf(exceptionsSnap)),
    };
}

/** Corre el motor para cada alumno cargado. */
function computeConditions(data, { rulesOverride, nowMs } = {}) {
    return data.students.map((student) => ({
        ...computeAcademicCondition({
            studentId: student.id,
            course: data.course,
            commission: student.commission,
            rulesOverride,
            rosterStatus: student.rosterStatus,
            attendance: data.attendance,
            assignments: data.assignments,
            submissions: data.submissionsByStudent[student.id] || {},
            // Un parcial con comisión solo cuenta para los alumnos de esa comisión.
            assessments: data.assessments.filter((a) => !a.commission || a.commission === student.commission),
            assessmentGrades: data.gradesByStudent[student.id] || {},
            exceptions: data.exceptionsByStudent[student.id] || [],
            nowMs,
        }),
        full_name: student.profile ? student.profile.full_name || student.profile.email || '' : '',
        email: student.profile ? student.profile.email || '' : '',
        matricula_unrn: student.profile ? student.profile.matricula_unrn || '' : '',
    }));
}

module.exports = { loadCourseAcademicData, computeConditions, preferSubmission };
