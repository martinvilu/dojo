const logger = require("firebase-functions/logger");

/**
 * Early-dropout analytics. Combines attendance, assignment delivery and
 * forum participation into a comparable 0-100 risk score per student.
 *
 * Factor weights (penalty points):
 *   - attendance gaps ......... up to 45
 *   - pending assignments ..... up to 35
 *   - late deliveries ......... up to 10
 *   - forum inactivity ........ up to 10
 *
 * Levels: >= 60 ALTO, >= 35 MEDIO, otherwise BAJO. Courses without recorded
 * classes or published assignments simply zero out those factors so early-
 * term reports stay meaningful instead of flagging everyone.
 */

const WEIGHTS = {
  ATTENDANCE: 45,
  PENDING: 35,
  LATE: 10,
  FORUM: 10
};

const PRESENT_STATUSES = ["present", "late"];

function computeRiskScore({ attendanceRatio, pendingRatio, lateRatio, hasForumActivity }) {
  // Neutral defaults when a signal has no data yet (early term).
  const safe = (v, neutral) => {
    if (v === undefined || v === null || Number.isNaN(Number(v))) return neutral;
    return Math.max(0, Math.min(1, Number(v)));
  };

  const attendancePenalty = (1 - safe(attendanceRatio, 1)) * WEIGHTS.ATTENDANCE;
  const pendingPenalty = safe(pendingRatio, 0) * WEIGHTS.PENDING;
  const latePenalty = safe(lateRatio, 0) * WEIGHTS.LATE;
  const forumPenalty = hasForumActivity ? 0 : WEIGHTS.FORUM;

  const score = Math.round(attendancePenalty + pendingPenalty + latePenalty + forumPenalty);
  return {
    score: Math.max(0, Math.min(100, score)),
    factors: {
      attendance: Math.round(attendancePenalty),
      pending: Math.round(pendingPenalty),
      late: Math.round(latePenalty),
      forum: forumPenalty
    }
  };
}

function riskLevel(score) {
  if (score >= 60) return "ALTO";
  if (score >= 35) return "MEDIO";
  return "BAJO";
}

async function getDropoutRiskAnalysis(payload, context) {
    const { uid, db } = context;
    const { courseId } = payload;
    if (!courseId) throw new Error("El parámetro courseId es requerido");

    const accessSnap = await db.collection('course_teachers').doc(`${courseId}_${uid}`).get();
    if (!accessSnap.exists) throw new Error("No tienes acceso a este curso");

    const courseSnap = await db.collection('courses').doc(courseId).get();
    if (!courseSnap.exists) throw new Error("Curso no encontrado");
    const course = courseSnap.data();

    const totalClasses = (course.class_instances || []).length;
    const assignmentsSnap = await db.collection('assignments').where('course_id', '==', courseId).get();
    const assignmentById = {};
    assignmentsSnap.docs.forEach(d => { assignmentById[d.id] = d.data(); });
    const totalAssignments = assignmentsSnap.size;

    // Sub-collection attendance (per-class records map) ...
    const attCollSnap = await db.collection('courses').doc(courseId).collection('attendance').get();
    const attendanceByStudent = {};
    attCollSnap.docs.forEach(doc => {
        const records = doc.data().records || {};
        Object.entries(records).forEach(([sid, status]) => {
            if (!attendanceByStudent[sid]) attendanceByStudent[sid] = [];
            attendanceByStudent[sid].push(status);
        });
    });
    // ... merged with legacy per-document global attendance.
    const globalAttSnap = await db.collection('attendance').where('course_id', '==', courseId).get();
    globalAttSnap.docs.forEach(doc => {
        const sid = doc.data().student_id;
        if (!sid) return;
        if (!attendanceByStudent[sid]) attendanceByStudent[sid] = [];
        attendanceByStudent[sid].push(doc.data().status || 'present');
    });

    // Forum participation per student.
    const commentsSnap = await db.collection('courses').doc(courseId).collection('class_comments').get();
    const forumByStudent = {};
    commentsSnap.docs.forEach(doc => {
        const sid = doc.data().user_id;
        if (!sid) return;
        if (!forumByStudent[sid]) forumByStudent[sid] = { comments: 0, bestAnswers: 0 };
        forumByStudent[sid].comments += 1;
        if (doc.data().is_best_answer) forumByStudent[sid].bestAnswers += 1;
    });

    const rosterSnap = await db.collection('course_roster')
        .where('course_id', '==', courseId)
        .where('status', 'in', ['approved', 'pending', 'observador'])
        .get();

    const now = Date.now();
    const results = [];

    for (const studentDoc of rosterSnap.docs) {
        const studentId = studentDoc.data().student_id;

        const pSnap = await db.collection('profiles').doc(studentId).get();
        const prof = pSnap.exists ? pSnap.data() : {};

        const statuses = attendanceByStudent[studentId] || [];
        const presentCount = statuses.filter(s => PRESENT_STATUSES.includes(s)).length;
        const attendanceRatio = totalClasses > 0 ? presentCount / totalClasses : 1;

        const subSnap = await db.collection('submissions')
            .where('student_id', '==', studentId)
            .get();
        const courseSubmissions = subSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(s => assignmentById[s.assignment_id]);

        const submittedIds = new Set(courseSubmissions.map(s => s.assignment_id));
        const pendingCount = totalAssignments - courseSubmissions.length;

        let lateCount = 0;
        courseSubmissions.forEach(s => {
            const due = assignmentById[s.assignment_id]?.due_date;
            const createdMs = s.created_at?.toMillis?.() ?? null;
            if (due && createdMs) {
                const dueMs = new Date(due).getTime();
                if (!isNaN(dueMs) && createdMs > dueMs) lateCount += 1;
            }
        });
        const lateRatio = totalAssignments > 0 ? lateCount / totalAssignments : 0;

        const forum = forumByStudent[studentId];
        const hasForumActivity = Boolean(forum && forum.comments > 0);

        const { score, factors } = computeRiskScore({
            attendanceRatio,
            pendingRatio: totalAssignments > 0 ? pendingCount / totalAssignments : 0,
            lateRatio,
            hasForumActivity
        });

        results.push({
            student_id: studentId,
            full_name: prof.full_name || 'Sin nombre',
            email: prof.email || '',
            github_user: prof.github_user || null,
            score,
            level: riskLevel(score),
            factors,
            metrics: {
                attendance_present: presentCount,
                attendance_total: totalClasses,
                attendance_ratio: Math.round(attendanceRatio * 100),
                submitted: courseSubmissions.length,
                pending: pendingCount,
                total_assignments: totalAssignments,
                late: lateCount,
                forum_comments: forum?.comments || 0,
                forum_best_answers: forum?.bestAnswers || 0
            },
            _now: now
        });
    }

    results.sort((a, b) => b.score - a.score);

    return {
        generated_at: new Date().toISOString(),
        total_classes: totalClasses,
        total_assignments: totalAssignments,
        students: results.map(({ _now, ...r }) => r)
    };
}

module.exports = { getDropoutRiskAnalysis, computeRiskScore, riskLevel, WEIGHTS, PRESENT_STATUSES };
