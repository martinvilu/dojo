/**
 * Condición académica de un estudiante (SPEC §1.1 y §1.2, plan F2.5).
 *
 * Función pura: recibe los datos ya cargados y devuelve la condición con el
 * detalle de cada criterio y los motivos en castellano. La carga desde
 * Firestore vive en `loader.js`.
 *
 * Mientras la cursada está abierta la condición es provisional y se calcula
 * con los datos actuales. Precedencia:
 *   Baja        el alumno fue dado de baja del padrón.
 *   Ausente     sin ninguna actividad después de las clases mínimas.
 *   EN RIESGO   algún criterio de regularidad ya está incumplido.
 *   Promocionado todos los criterios de regularidad y de promoción cumplidos.
 *   Regular     regularidad cumplida (la promoción no, o todavía no).
 *   Condicional sin incumplimientos, pero con criterios aún pendientes.
 *
 * Cada criterio tiene estado 'ok' | 'pending' | 'failed' | 'na' (no aplica:
 * p. ej. la cátedra todavía no cargó parciales); 'na' no bloquea.
 */
const { resolveRules } = require('./rules');
const { lateness, isPastDeadline, toMs } = require('./deadlines');

const CONDITIONS = Object.freeze({
    PROMOCIONADO: 'Promocionado',
    REGULAR: 'Regular',
    CONDICIONAL: 'Condicional',
    EN_RIESGO: 'EN RIESGO',
    AUSENTE: 'Ausente',
    BAJA: 'Baja',
});

const NUMERIC_RE = /^\s*\d+([.,]\d+)?\s*$/;
const APPROVED_CONCEPTS = new Set(['aprobado', 'aprobada', 'ok', 'promocionado', 'promocionada', 'approved']);
const DELIVERED_STATUSES = new Set(['submitted', 'approved', 'ok', 'changes_requested', 'resubmitted']);
const ATTENDED = new Set(['present', 'late']);
const BAJA_STATUSES = new Set(['removed', 'baja']);

function numericGrade(grade) {
    if (typeof grade === 'number') return Number.isFinite(grade) ? grade : null;
    if (typeof grade !== 'string' || !NUMERIC_RE.test(grade)) return null;
    return Number(grade.replace(',', '.'));
}

function hasGrade(grade) {
    return grade !== null && grade !== undefined && String(grade).trim() !== '';
}

function isOk(status) {
    return status === 'ok' || status === 'na';
}

function pct(ratio) {
    return `${Math.round(ratio * 100)}%`;
}

function fmt(n) {
    return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100).replace('.', ',');
}

// --- asistencia -----------------------------------------------------------

/**
 * @param attendance [{ classNumber, records: { [uid]: 'present'|'late'|'absent'|'justified' } }]
 *   Solo cuentan las clases en las que se tomó asistencia (records no vacío).
 */
function evaluateAttendance(attendance, studentId, rules, waived) {
    const held = (attendance || [])
        .filter((c) => c && c.records && Object.keys(c.records).length > 0)
        .sort((a, b) => Number(a.classNumber) - Number(b.classNumber));

    let attended = 0;
    let justified = 0;
    let streak = 0;
    for (const c of held) {
        const status = c.records[studentId];
        if (status === 'justified') {
            justified++;
            continue;
        }
        if (ATTENDED.has(status)) {
            attended++;
            streak = 0;
        } else {
            streak++;
        }
    }
    const counted = held.length - justified;
    const ratio = counted > 0 ? attended / counted : null;

    let status;
    if (waived) status = 'ok';
    else if (held.length < rules.min_classes_for_attendance || ratio === null) status = 'pending';
    else status = ratio >= rules.min_attendance ? 'ok' : 'failed';

    // Presentes consecutivos necesarios para volver al mínimo.
    let classesToRecover = 0;
    if (status === 'failed' && rules.min_attendance < 1) {
        classesToRecover = Math.max(0, Math.ceil((rules.min_attendance * counted - attended) / (1 - rules.min_attendance)));
    }

    return {
        status,
        ratio,
        attended,
        held: held.length,
        justified,
        waived: Boolean(waived),
        required: rules.min_attendance,
        absence_streak: streak,
        classes_to_recover: classesToRecover,
    };
}

// --- trabajos prácticos ---------------------------------------------------

function isDelivered(sub) {
    if (!sub) return false;
    return DELIVERED_STATUSES.has(sub.status) || toMs(sub.submitted_at) !== null || hasGrade(sub.grade);
}

function isApproved(sub, rules) {
    if (!sub) return false;
    if (sub.status === 'approved' || sub.status === 'ok') return true;
    const n = numericGrade(sub.grade);
    if (n !== null) return n >= rules.partial_pass_grade;
    return hasGrade(sub.grade) && APPROVED_CONCEPTS.has(String(sub.grade).trim().toLowerCase());
}

function evaluateTps(assignments, submissions, exceptions, rules, nowMs) {
    const active = (assignments || []).filter((a) => a && !a.is_archived);
    const requiredIds = rules.required_tps === 'all'
        ? new Set(active.filter((a) => a.is_required !== false).map((a) => a.id))
        : new Set(rules.required_tps);

    const extensions = {};
    const exemptRequested = [];
    for (const e of exceptions || []) {
        if (e.type === 'deadline_extension' && e.assignment_id) {
            extensions[e.assignment_id] = (extensions[e.assignment_id] || 0) + (Number(e.extra_hours) || 0);
        }
        if (e.type === 'tp_exempt' && e.assignment_id && requiredIds.has(e.assignment_id)) {
            exemptRequested.push(e.assignment_id);
        }
    }
    // Solo valen hasta max_exempt_tps excepciones, en orden de otorgamiento.
    const exempt = new Set([...new Set(exemptRequested)].slice(0, rules.max_exempt_tps));

    const items = active.map((a) => {
        const sub = submissions[a.id];
        const delivered = isDelivered(sub);
        const approved = isApproved(sub, rules);
        const extension = extensions[a.id] || 0;
        const late = delivered && (sub.late === true
            || lateness(sub.submitted_at, a.due_date, rules.late_tolerance_hours, extension).late);
        const overdue = isPastDeadline(nowMs, a.due_date, rules.late_tolerance_hours, extension);
        const graded = sub ? hasGrade(sub.grade) : false;
        let state;
        if (approved) state = 'approved';
        else if (delivered && graded && sub.status !== 'changes_requested') state = 'not_approved';
        else if (delivered) state = 'delivered';
        else state = overdue ? 'missing' : 'pending';
        return {
            id: a.id,
            title: a.title || a.id,
            required: requiredIds.has(a.id),
            exempt: exempt.has(a.id),
            state,
            late,
        };
    });

    const counted = items.filter((i) => i.required && !i.exempt);
    const missing = counted.filter((i) => i.state === 'missing');
    const pending = counted.filter((i) => i.state === 'pending');
    const approved = counted.filter((i) => i.state === 'approved');
    // Lo que todavía puede terminar en OK: sin entregar a tiempo, o entregado sin nota.
    const open = counted.filter((i) => i.state === 'pending' || i.state === 'delivered');
    const lateCount = items.filter((i) => i.late).length;

    let regularity;
    if (counted.length === 0) regularity = 'na';
    else if (missing.length > 0) regularity = 'failed';
    else if (pending.length > 0) regularity = 'pending';
    else regularity = 'ok';

    const okRatio = counted.length > 0 ? approved.length / counted.length : null;
    const neededForPromotion = Math.ceil(rules.promotion_ok_ratio * counted.length);
    let okRatioStatus;
    if (counted.length === 0) okRatioStatus = 'na';
    else if (approved.length >= neededForPromotion) okRatioStatus = 'ok';
    else if (approved.length + open.length >= neededForPromotion) okRatioStatus = 'pending';
    else okRatioStatus = 'failed';

    return {
        regularity: {
            status: regularity,
            required: counted.length,
            delivered: counted.length - missing.length - pending.length,
            missing: missing.map((i) => i.title),
            pending: pending.length,
            exempt: [...exempt],
        },
        okRatio: {
            status: okRatioStatus,
            ratio: okRatio,
            approved: approved.length,
            needed: neededForPromotion,
            required_ratio: rules.promotion_ok_ratio,
        },
        late: {
            status: lateCount <= rules.max_late_for_promotion ? 'ok' : 'failed',
            count: lateCount,
            max: rules.max_late_for_promotion,
        },
        items,
    };
}

// --- parciales ------------------------------------------------------------

function evaluatePartials(assessments, grades, rules) {
    const active = (assessments || []).filter((a) => a && !a.archived);
    const parciales = active.filter((a) => a.kind === 'parcial');
    const recoveries = active.filter((a) => a.kind === 'recuperatorio');

    const gradeOf = (id) => {
        const g = grades[id];
        if (!g) return { graded: false, value: null, absent: false };
        if (g.absent) return { graded: true, value: null, absent: true };
        const value = numericGrade(g.grade);
        return { graded: value !== null, value, absent: false };
    };

    const items = parciales.map((p) => {
        const original = gradeOf(p.id);
        const recs = recoveries.filter((r) => r.recovers === p.id).map((r) => ({ id: r.id, label: r.label, ...gradeOf(r.id) }));
        const values = [original.value, ...recs.map((r) => r.value)].filter((v) => v !== null);
        const best = values.length ? Math.max(...values) : null;
        const ungradedRecovery = recs.some((r) => !r.graded);

        let regularity;
        if (best !== null && best >= rules.partial_pass_grade) regularity = 'ok';
        else if (!original.graded || ungradedRecovery) regularity = 'pending';
        else regularity = 'failed';

        const recoveryValues = recs.map((r) => r.value).filter((v) => v !== null);
        const bestRecovery = recoveryValues.length ? Math.max(...recoveryValues) : null;
        const candidate = rules.allow_promotion_via_recovery ? best : original.value;
        let promotion;
        if (candidate !== null && candidate >= rules.promotion_grade) promotion = 'ok';
        else if (!original.graded || (rules.allow_promotion_via_recovery && ungradedRecovery)) promotion = 'pending';
        else promotion = 'failed';

        return {
            id: p.id,
            label: p.label || p.id,
            original: original.value,
            absent: original.absent,
            recoveries: recs.map(({ id, label, value, absent }) => ({ id, label, value, absent })),
            best,
            best_recovery: bestRecovery,
            regularity,
            promotion,
            promotion_candidate: candidate,
        };
    });

    const combine = (key) => {
        if (items.length === 0) return 'na';
        if (items.some((i) => i[key] === 'failed')) return 'failed';
        if (items.some((i) => i[key] === 'pending')) return 'pending';
        return 'ok';
    };

    return { regularity: combine('regularity'), promotion: combine('promotion'), items };
}

// --- condición ------------------------------------------------------------

/**
 * @param {object} input
 * @param {string} input.studentId
 * @param {object} input.course            documento del curso (reglas)
 * @param {string} [input.commission]      comisión del alumno en el curso
 * @param {object} [input.rulesOverride]   reglas hipotéticas (simulador)
 * @param {string} [input.rosterStatus]
 * @param {Array}  input.attendance        [{ classNumber, records }]
 * @param {Array}  input.assignments       [{ id, title, due_date, is_required, is_archived }]
 * @param {object} input.submissions       { [assignmentId]: submission }
 * @param {Array}  input.assessments       [{ id, kind, label, recovers, archived }]
 * @param {object} input.assessmentGrades  { [assessmentId]: { grade, absent } }
 * @param {Array}  input.exceptions        [{ type, assignment_id, extra_hours }]
 * @param {number} [input.nowMs]
 */
function computeAcademicCondition(input) {
    const rules = { ...resolveRules(input.course, input.commission), ...(input.rulesOverride || {}) };
    const nowMs = input.nowMs || Date.now();
    const exceptions = (input.exceptions || []).filter((e) => !e.revoked);

    const attendance = evaluateAttendance(
        input.attendance, input.studentId, rules,
        exceptions.some((e) => e.type === 'attendance_waiver')
    );
    const tps = evaluateTps(input.assignments, input.submissions || {}, exceptions, rules, nowMs);
    const partials = evaluatePartials(input.assessments, input.assessmentGrades || {}, rules);

    const regularity = { attendance: attendance.status, tps: tps.regularity.status, partials: partials.regularity };
    const promotion = { ok_ratio: tps.okRatio.status, late: tps.late.status, partials: partials.promotion };

    const reasons = [];
    if (attendance.status === 'failed') {
        reasons.push(`Asistencia ${pct(attendance.ratio)} (mínimo ${pct(rules.min_attendance)}).`);
    }
    for (const title of tps.regularity.missing) reasons.push(`TP «${title}» vencido sin entregar.`);
    for (const p of partials.items) {
        if (p.regularity === 'failed') {
            reasons.push(p.absent && p.best === null
                ? `${p.label}: ausente sin recuperar.`
                : `${p.label}: ${fmt(p.best)} (se aprueba con ${fmt(rules.partial_pass_grade)}).`);
        }
    }
    if (tps.okRatio.status === 'failed') {
        reasons.push(`TPs en OK: ${tps.okRatio.approved}/${tps.regularity.required} (para promocionar hacen falta ${tps.okRatio.needed}).`);
    }
    if (tps.late.status === 'failed') {
        reasons.push(`${tps.late.count} entregas fuera de término (máximo ${tps.late.max} para promocionar).`);
    }
    for (const p of partials.items) {
        if (p.promotion === 'failed' && p.regularity !== 'failed') {
            const viaRecovery = !rules.allow_promotion_via_recovery
                && p.best_recovery !== null && p.best_recovery >= rules.promotion_grade;
            reasons.push(viaRecovery
                ? `${p.label}: aprobado en recuperatorio; esta comisión no promociona por recuperatorio.`
                : `${p.label}: ${fmt(p.promotion_candidate)} (para promocionar hace falta ${fmt(rules.promotion_grade)}).`);
        }
    }

    const anyActivity = attendance.attended > 0
        || tps.items.some((i) => i.state !== 'pending' && i.state !== 'missing')
        || partials.items.some((p) => p.original !== null || p.recoveries.some((r) => r.value !== null));

    let condition;
    if (BAJA_STATUSES.has(input.rosterStatus)) condition = CONDITIONS.BAJA;
    else if (!anyActivity && attendance.held >= rules.min_classes_for_attendance) condition = CONDITIONS.AUSENTE;
    else if (Object.values(regularity).includes('failed')) condition = CONDITIONS.EN_RIESGO;
    else if (Object.values(regularity).every(isOk) && Object.values(promotion).every(isOk)) condition = CONDITIONS.PROMOCIONADO;
    else if (Object.values(regularity).every(isOk)) condition = CONDITIONS.REGULAR;
    else condition = CONDITIONS.CONDICIONAL;

    return {
        student_id: input.studentId,
        commission: input.commission || null,
        condition,
        provisional: true,
        regularity,
        promotion,
        attendance,
        tps: { ...tps.regularity, ok_ratio: tps.okRatio, late: tps.late, items: tps.items },
        partials: partials.items,
        reasons,
        ...edgeCases({ condition, attendance, tps, partials, rules, regularity, promotion }),
    };
}

/**
 * Casos borde (UC-D17): a 1 punto o 1 TP de promocionar o regularizar.
 */
function edgeCases({ condition, attendance, tps, partials, rules, regularity, promotion }) {
    const failingPromotion = Object.entries(promotion).filter(([, s]) => s === 'failed');
    let nearPromotion = false;
    if ((condition === CONDITIONS.REGULAR || condition === CONDITIONS.CONDICIONAL) && failingPromotion.length === 1) {
        const [criterion] = failingPromotion[0];
        if (criterion === 'ok_ratio') nearPromotion = tps.okRatio.needed - tps.okRatio.approved === 1;
        if (criterion === 'late') nearPromotion = tps.late.count - tps.late.max === 1;
        if (criterion === 'partials') {
            const failed = partials.items.filter((p) => p.promotion === 'failed');
            nearPromotion = failed.length === 1 && failed[0].promotion_candidate !== null
                && rules.promotion_grade - failed[0].promotion_candidate <= 1;
        }
    }

    const failingRegularity = Object.entries(regularity).filter(([, s]) => s === 'failed');
    let nearRegularity = false;
    if (condition === CONDITIONS.EN_RIESGO && failingRegularity.length === 1) {
        const [criterion] = failingRegularity[0];
        if (criterion === 'attendance') nearRegularity = attendance.classes_to_recover <= 1;
        if (criterion === 'tps') nearRegularity = tps.regularity.missing.length === 1;
        if (criterion === 'partials') {
            const failed = partials.items.filter((p) => p.regularity === 'failed');
            nearRegularity = failed.length === 1 && failed[0].best !== null
                && rules.partial_pass_grade - failed[0].best <= 1;
        }
    }
    return { near_promotion: nearPromotion, near_regularity: nearRegularity };
}

module.exports = {
    CONDITIONS,
    computeAcademicCondition,
    evaluateAttendance,
    evaluateTps,
    evaluatePartials,
    numericGrade,
};
