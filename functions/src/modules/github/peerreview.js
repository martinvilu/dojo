const { FieldValue } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

/**
 * Rubric-based peer review between students.
 *
 * - Teacher enables peer review on an assignment with a rubric
 *   [{ name, maxPoints }].
 * - Reviewers are deterministically paired with other submitters (no storage
 *   needed): ordering is seeded by hashing assignmentId+studentId, and each
 *   reviewer sees the next PEERS_PER_REVIEWER submitters in that cycle who
 *   they haven't reviewed yet.
 * - Reviews are anonymous towards reviewees; only teachers see authorship.
 */

const PEERS_PER_REVIEWER = 2;

function simpleHash(str) {
    // FNV-1a: good avalanche for short id strings so pairings rotate
    // meaningfully between assignments.
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h;
}

function validateRubric(rubric) {
    if (!Array.isArray(rubric) || rubric.length === 0 || rubric.length > 8) {
        throw new Error("La rúbrica debe tener entre 1 y 8 criterios.");
    }
    return rubric.map((c) => {
        const name = String(c.name || "").trim();
        const maxPoints = Number(c.maxPoints);
        if (!name) throw new Error("Cada criterio necesita un nombre.");
        if (!Number.isFinite(maxPoints) || maxPoints < 0 || maxPoints > 100) {
            throw new Error(`Puntaje máximo inválido para "${name}" (0-100).`);
        }
        return { name, maxPoints };
    });
}

async function requireCourseTeacher(db, courseId, uid) {
    const accessSnap = await db.collection('course_teachers').doc(`${courseId}_${uid}`).get();
    if (!accessSnap.exists) throw new Error("No tienes acceso a este curso");
}

async function enablePeerReview(payload, context) {
    const { uid, db } = context;
    const { assignmentId, enabled, rubric } = payload;
    if (!assignmentId) throw new Error("El parámetro assignmentId es requerido");

    const aSnap = await db.collection('assignments').doc(assignmentId).get();
    if (!aSnap.exists) throw new Error("La tarea no existe");
    await requireCourseTeacher(db, aSnap.data().course_id, uid);

    const update = {
        'peer_review.enabled': Boolean(enabled),
        'peer_review.updated_at': FieldValue.serverTimestamp()
    };
    if (enabled) {
        update['peer_review.rubric'] = validateRubric(rubric);
    }

    await db.collection('assignments').doc(assignmentId).update(update);
    return { success: true };
}

async function listSubmitters(db, assignmentId) {
    const snap = await db.collection('submissions').where('assignment_id', '==', assignmentId).get();
    return snap.docs.map(d => d.data().student_id);
}

function pickReviewees(assignmentId, myId, submitters, alreadyReviewed, count = PEERS_PER_REVIEWER) {
    const ordered = [...new Set(submitters)].sort(
        (a, b) => simpleHash(`${assignmentId}:${a}`) - simpleHash(`${assignmentId}:${b}`)
    );
    const idx = ordered.indexOf(myId);
    if (idx === -1) return [];

    const result = [];
    for (let step = 1; step <= ordered.length - 1 && result.length < count; step++) {
        const candidate = ordered[(idx + step) % ordered.length];
        if (candidate !== myId && !alreadyReviewed.has(candidate)) {
            result.push(candidate);
        }
    }
    return result;
}

async function getMyReviewAssignments(payload, context) {
    const { uid, db } = context;
    const { courseId } = payload;
    if (!courseId) throw new Error("El parámetro courseId es requerido");

    const assignmentsSnap = await db.collection('assignments')
        .where('course_id', '==', courseId)
        .get();

    const mine = [];
    for (const doc of assignmentsSnap.docs) {
        const assignment = doc.data();
        if (!assignment.peer_review?.enabled) continue;

        const submitters = await listSubmitters(db, doc.id);

        const myReviewsSnap = await db.collection('peer_reviews')
            .where('assignment_id', '==', doc.id)
            .where('reviewer_id', '==', uid)
            .get();
        const alreadyReviewed = new Set(
            myReviewsSnap.docs.map(d => d.data().reviewee_id)
        );

        const pendingReviewees = pickReviewees(doc.id, uid, submitters, alreadyReviewed);

        let mySubmission = null;
        if (submitters.includes(uid)) {
            const mySubs = await db.collection('submissions')
                .where('assignment_id', '==', doc.id)
                .get();
            const found = mySubs.docs.find(d => d.data().student_id === uid);
            mySubmission = found ? { id: found.id, repo_url: found.data().repo_url || null } : null;
        }

        mine.push({
            assignment_id: doc.id,
            title: assignment.title,
            due_date: assignment.due_date || null,
            rubric: assignment.peer_review.rubric || [],
            has_submitted: Boolean(mySubmission),
            pending_reviewees: pendingReviewees,
            reviewed_count: alreadyReviewed.size
        });
    }

    return mine;
}

async function submitPeerReview(payload, context) {
    const { uid, db } = context;
    const { assignmentId, revieweeId, scores, comment } = payload;
    if (!assignmentId || !revieweeId || typeof scores !== 'object' || scores === null) {
        throw new Error("Faltan parámetros requeridos");
    }
    if (revieweeId === uid) throw new Error("No podés revisarte a vos mismo.");

    const aSnap = await db.collection('assignments').doc(assignmentId).get();
    if (!aSnap.exists) throw new Error("La tarea no existe");
    const assignment = aSnap.data();
    if (!assignment.peer_review?.enabled) throw new Error("La revisión entre pares no está activa para esta tarea.");

    const rubric = assignment.peer_review.rubric || [];
    const normalizedScores = {};
    for (const criterion of rubric) {
        const value = Number(scores[criterion.name]);
        if (!Number.isFinite(value) || value < 0 || value > criterion.maxPoints) {
            throw new Error(`Puntaje inválido para "${criterion.name}" (0-${criterion.maxPoints}).`);
        }
        normalizedScores[criterion.name] = value;
    }

    const submitters = new Set(await listSubmitters(db, assignmentId));
    if (!submitters.has(uid)) throw new Error("Debés entregar tu propia resolución antes de revisar a tus pares.");
    if (!submitters.has(revieweeId)) throw new Error("El compañero elegido no tiene entrega en esta tarea.");

    const dupSnap = await db.collection('peer_reviews')
        .where('assignment_id', '==', assignmentId)
        .where('reviewer_id', '==', uid)
        .get();
    if (dupSnap.docs.some(d => d.data().reviewee_id === revieweeId)) {
        throw new Error("Ya revisaste a este compañero para esta tarea.");
    }

    const ref = await db.collection('peer_reviews').add({
        assignment_id: assignmentId,
        reviewer_id: uid,
        reviewee_id: revieweeId,
        scores: normalizedScores,
        comment: String(comment || '').slice(0, 2000),
        created_at: FieldValue.serverTimestamp()
    });
    logger.info("[peer-review] stored", { reviewId: ref.id });
    return { success: true, reviewId: ref.id };
}

async function getPeerReviewFeedback(payload, context) {
    const { uid, db } = context;
    const { assignmentId } = payload;
    if (!assignmentId) throw new Error("El parámetro assignmentId es requerido");

    const aSnap = await db.collection('assignments').doc(assignmentId).get();
    if (!aSnap.exists) throw new Error("La tarea no existe");
    const assignment = aSnap.data();

    const reviewsSnap = await db.collection('peer_reviews')
        .where('assignment_id', '==', assignmentId)
        .get();
    const reviews = reviewsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const teacherAccess = await db.collection('course_teachers').doc(`${assignment.course_id}_${uid}`).get();
    const isTeacher = teacherAccess.exists;

    const visible = isTeacher ? reviews : reviews.filter(r => r.reviewee_id === uid);

    // Anonymous aggregate per reviewee: average per rubric criterion + comments.
    const byReviewee = {};
    visible.forEach((r) => {
        if (!byReviewee[r.reviewee_id]) {
            byReviewee[r.reviewee_id] = {
                totals: {},
                counts: {},
                comments: []
            };
        }
        Object.entries(r.scores || {}).forEach(([criterion, value]) => {
            byReviewee[r.reviewee_id].totals[criterion] = (byReviewee[r.reviewee_id].totals[criterion] || 0) + Number(value);
            byReviewee[r.reviewee_id].counts[criterion] = (byReviewee[r.reviewee_id].counts[criterion] || 0) + 1;
        });
        if (r.comment) byReviewee[r.reviewee_id].comments.push(r.comment);
    });

    const feedback = Object.entries(byReviewee).map(([studentId, agg]) => ({
        student_id: studentId,
        averages: Object.fromEntries(
            Object.entries(agg.totals).map(([criterion, total]) => [
                criterion,
                Math.round((total / agg.counts[criterion]) * 10) / 10
            ])
        ),
        review_count: Math.max(0, ...Object.values(agg.counts)),
        comments: agg.comments
    }));

    return {
        rubric: assignment.peer_review?.rubric || [],
        is_teacher_view: isTeacher,
        total_reviews: reviews.length,
        feedback
    };
}

module.exports = {
    enablePeerReview,
    getMyReviewAssignments,
    submitPeerReview,
    getPeerReviewFeedback,
    pickReviewees,
    validateRubric,
    PEERS_PER_REVIEWER
};
