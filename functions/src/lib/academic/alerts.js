/**
 * Alertas tempranas de retención (SPEC §1.3, plan F4.1–F4.2).
 *
 * `detectAlerts` es puro: recibe la condición académica ya calculada y los
 * datos del alumno y devuelve las alertas vigentes. `reconcileAlert` decide
 * qué hacer con el documento persistido de cada alerta para no re-disparar
 * las que la cátedra ya está siguiendo o pospuso.
 */
const { toMs, isPastDeadline, HOUR_MS } = require('./deadlines');

const ALERT_TYPES = Object.freeze({
    ATTENDANCE: 'attendance_critical',
    OVERDUE: 'overdue_tps',
    NO_REPO: 'no_repo',
    SILENT: 'silent_dropout',
});

const ALERT_LABELS = Object.freeze({
    [ALERT_TYPES.ATTENDANCE]: 'Asistencia crítica',
    [ALERT_TYPES.OVERDUE]: 'Tareas atrasadas',
    [ALERT_TYPES.NO_REPO]: 'Sin repositorio',
    [ALERT_TYPES.SILENT]: 'Deserción silenciosa',
});

const DAY_MS = 24 * HOUR_MS;
const OPEN_STATUSES = new Set(['active', 'contacted', 'snoozed']);

const pct = (r) => `${Math.round(r * 100)}%`;

/** Prácticas publicadas cuyo plazo (con tolerancia) sigue abierto. */
function openAssignments(assignments, rules, nowMs) {
    return assignments.filter((a) => !a.is_archived
        && (toMs(a.created_at) || 0) <= nowMs
        && !isPastDeadline(nowMs, a.due_date, rules.late_tolerance_hours));
}

/**
 * @param {object} p
 * @param {object} p.condition        resultado de computeAcademicCondition
 * @param {object} p.rules            reglas efectivas del alumno
 * @param {Array}  p.assignments
 * @param {object} p.submissions      { [assignmentId]: submission }
 * @param {number|null} p.lastMoodleActivityMs
 * @param {number} p.nowMs
 */
function detectAlerts({ condition, rules, assignments, submissions, lastMoodleActivityMs, nowMs }) {
    if (condition.condition === 'Baja') return [];
    const alerts = [];
    const { attendance, tps } = condition;
    const exempt = new Set(tps.exempt || []);

    if (!attendance.waived) {
        if (attendance.status === 'failed') {
            alerts.push({ type: ALERT_TYPES.ATTENDANCE, message: `Asistencia ${pct(attendance.ratio)} (mínimo ${pct(attendance.required)}).` });
        } else if (attendance.absence_streak >= rules.consecutive_absences_alert) {
            alerts.push({ type: ALERT_TYPES.ATTENDANCE, message: `${attendance.absence_streak} inasistencias seguidas.` });
        }
    }

    if (tps.missing.length > 0) {
        alerts.push({ type: ALERT_TYPES.OVERDUE, message: `TP vencidos sin entregar: ${tps.missing.join(', ')}.` });
    }

    const graceMs = rules.no_repo_alert_days * DAY_MS;
    const withoutRepo = assignments.filter((a) => !a.is_archived && a.template_repo && !exempt.has(a.id)
        && !submissions[a.id]
        && toMs(a.created_at) !== null && nowMs - toMs(a.created_at) >= graceMs);
    if (withoutRepo.length > 0) {
        alerts.push({
            type: ALERT_TYPES.NO_REPO,
            message: `Sin repositorio a ${rules.no_repo_alert_days} días de publicada: ${withoutRepo.map((a) => a.title || a.id).join(', ')}.`,
        });
    }

    // Sigue entrando a Moodle pero no arrancó ninguna práctica abierta:
    // suele indicar un bloqueo técnico (GitHub, plantilla, permisos).
    const open = openAssignments(assignments, rules, nowMs).filter((a) => !exempt.has(a.id));
    const recentMoodle = lastMoodleActivityMs !== null && lastMoodleActivityMs !== undefined
        && nowMs - lastMoodleActivityMs <= rules.silent_dropout_days * DAY_MS;
    if (recentMoodle && open.length > 0 && open.every((a) => !submissions[a.id])) {
        const days = Math.max(0, Math.floor((nowMs - lastMoodleActivityMs) / DAY_MS));
        alerts.push({
            type: ALERT_TYPES.SILENT,
            message: `Activo en Moodle ${days === 0 ? 'hoy' : `hace ${days} día${days === 1 ? '' : 's'}`} pero sin repositorio ni entrega en la práctica activa.`,
        });
    }
    return alerts;
}

/**
 * Qué hacer con la alerta persistida de un tipo:
 *   - detectada y sin documento (o resuelta): crear/reabrir como activa;
 *   - detectada y contactada: mantener (solo actualiza el mensaje);
 *   - detectada y pospuesta: mantener hasta `snoozed_until`, después reactivar;
 *   - no detectada y abierta: resolver automáticamente.
 * @returns {{ op: 'create' | 'update' | 'none', data?: object }}
 */
function reconcileAlert(existing, detected, nowMs) {
    if (detected) {
        if (!existing || existing.status === 'resolved') {
            return {
                op: existing ? 'update' : 'create',
                data: { status: 'active', message: detected.message, last_detected_at: new Date(nowMs), reopened: Boolean(existing) },
            };
        }
        if (existing.status === 'snoozed' && (toMs(existing.snoozed_until) || 0) <= nowMs) {
            return { op: 'update', data: { status: 'active', message: detected.message, last_detected_at: new Date(nowMs) } };
        }
        return { op: 'update', data: { message: detected.message, last_detected_at: new Date(nowMs) } };
    }
    if (existing && OPEN_STATUSES.has(existing.status)) {
        return { op: 'update', data: { status: 'resolved', resolved_at: new Date(nowMs), resolved_by: 'system' } };
    }
    return { op: 'none' };
}

module.exports = { ALERT_TYPES, ALERT_LABELS, detectAlerts, reconcileAlert, openAssignments };
