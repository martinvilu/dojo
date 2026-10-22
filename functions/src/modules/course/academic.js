/**
 * Reglas de cursada y condición académica (plan F2.1, F2.5, F2.6).
 */
const { HttpsError } = require('firebase-functions/v2/https');
const { DEFAULT_RULES, pickRules, resolveRules } = require('../../lib/academic/rules');
const { loadCourseAcademicData, computeConditions } = require('../../lib/academic/loader');
const { CONDITIONS } = require('../../lib/academic/condition');
const { isCourseStaff } = require('../../authz');
const { staffCommissionScope, assertCourseOpen, getClosure, NO_COMMISSION } = require('../../lib/courseGuards');

async function findActaRow(db, courseId, version, studentId) {
    const parts = await db.collection('course_closures').doc(courseId).collection('actas').doc(String(version)).collection('parts').get();
    for (const part of parts.docs) {
        const row = (part.data().rows || []).find((r) => r.student_id === studentId);
        if (row) return row;
    }
    return null;
}

/** Titular del curso o admin: los ayudantes no cambian reglas globales. */
async function assertCanEditRules(db, courseId, uid, profile) {
    if (profile && profile.role === 'admin') return;
    const snap = await db.collection('course_teachers').doc(`${courseId}_${uid}`).get();
    if (!snap.exists || snap.data().role === 'ayudante') {
        throw new HttpsError('permission-denied', 'Solo el profesor titular puede cambiar las reglas de la cursada.');
    }
}

function assertConsistent(rules, label) {
    if (rules.promotion_grade < rules.partial_pass_grade) {
        throw new HttpsError('invalid-argument', `${label}: la nota de promoción no puede ser menor que la de aprobación.`);
    }
}

async function getGradingRules(payload, context) {
    const { uid, db, getMyProfile } = context;
    const { courseId } = payload;
    const snap = await db.collection('courses').doc(courseId).get();
    if (!snap.exists) throw new HttpsError('not-found', 'Curso no encontrado.');
    const course = snap.data();
    const profile = getMyProfile ? await getMyProfile() : null;
    let canEdit = true;
    try {
        await assertCanEditRules(db, courseId, uid, profile);
    } catch {
        canEdit = false;
    }
    return {
        defaults: DEFAULT_RULES,
        rules: pickRules(course.grading_rules),
        effective: resolveRules(course),
        commissionOverrides: course.grading_rules_by_commission || {},
        commissions: Array.isArray(course.commissions) ? course.commissions : [],
        updatedAt: course.grading_rules_updated_at || null,
        canEdit,
    };
}

async function updateGradingRules(payload, context) {
    const { uid, db, admin, getMyProfile } = context;
    const { courseId, rules, commissionOverrides } = payload;
    const profile = getMyProfile ? await getMyProfile() : null;
    await assertCanEditRules(db, courseId, uid, profile);
    await assertCourseOpen(db, courseId);

    const ref = db.collection('courses').doc(courseId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Curso no encontrado.');
    const previous = snap.data();

    const nextCourse = {
        grading_rules: pickRules(rules),
        grading_rules_by_commission: commissionOverrides
            ? Object.fromEntries(Object.entries(commissionOverrides).map(([c, r]) => [c, pickRules(r)]))
            : previous.grading_rules_by_commission || {},
    };
    assertConsistent(resolveRules(nextCourse), 'Reglas del curso');
    for (const commission of Object.keys(nextCourse.grading_rules_by_commission)) {
        assertConsistent(resolveRules(nextCourse, commission), commission);
    }

    await ref.update({
        ...nextCourse,
        grading_rules_updated_at: admin.firestore.FieldValue.serverTimestamp(),
        grading_rules_updated_by: uid,
    });
    await db.collection('audit_logs').add({
        action: 'update_grading_rules',
        course_id: courseId,
        actor_id: uid,
        actor_name: profile ? profile.full_name || profile.email || '' : '',
        previous_rules: previous.grading_rules || {},
        previous_by_commission: previous.grading_rules_by_commission || {},
        new_rules: nextCourse.grading_rules,
        new_by_commission: nextCourse.grading_rules_by_commission,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true, effective: resolveRules(nextCourse) };
}

function summarize(results) {
    const counts = Object.fromEntries(Object.values(CONDITIONS).map((c) => [c, 0]));
    for (const r of results) counts[r.condition] = (counts[r.condition] || 0) + 1;
    return {
        total: results.length,
        byCondition: counts,
        nearPromotion: results.filter((r) => r.near_promotion).length,
        nearRegularity: results.filter((r) => r.near_regularity).length,
    };
}

/**
 * Condición de todo el padrón. Con `rulesOverride` simula otras reglas sin
 * guardarlas (base del simulador de cierre, UC-D17).
 */
async function getAcademicConditions(payload, context) {
    const { db, uid } = context;
    const { courseId, rulesOverride } = payload;
    const data = await loadCourseAcademicData(db, courseId);
    const scope = await staffCommissionScope(db, courseId, uid);
    const results = computeConditions(data, { rulesOverride: rulesOverride ? pickRules(rulesOverride) : undefined })
        .filter((r) => !scope || scope.includes(r.commission || NO_COMMISSION))
        .sort((a, b) => (a.full_name || a.email).localeCompare(b.full_name || b.email, 'es'));
    return {
        generatedAt: new Date().toISOString(),
        simulated: Boolean(rulesOverride),
        rules: { ...resolveRules(data.course), ...(rulesOverride ? pickRules(rulesOverride) : {}) },
        summary: summarize(results),
        results,
    };
}

/** Condición propia del estudiante que la consulta. */
async function getMyAcademicCondition(payload, context) {
    const { uid, db } = context;
    const { courseId } = payload;
    if (await isCourseStaff(db, courseId, uid)) {
        throw new HttpsError('failed-precondition', 'La condición académica es por estudiante; usá la vista de la cátedra.');
    }
    const data = await loadCourseAcademicData(db, courseId, { studentId: uid });
    const [result] = computeConditions(data);
    const student = data.students[0];
    const response = { ...result, rules: resolveRules(data.course, student.commission) };
    // Con el acta cerrada, la condición que vale es la congelada.
    const closure = await getClosure(db, courseId);
    if (closure && closure.status === 'closed') {
        const row = await findActaRow(db, courseId, closure.version, uid);
        if (row) {
            response.provisional = false;
            response.final = { version: closure.version, condition: row.condition, siu_condition: row.siu_condition, final_grade: row.final_grade };
        }
    }
    return response;
}

module.exports = {
    getGradingRules,
    updateGradingRules,
    getAcademicConditions,
    getMyAcademicCondition,
    assertCanEditRules,
};
