/**
 * Reglas parametrizables de regularidad y promoción (SPEC §1.2, plan F2.1).
 *
 * Se guardan en `courses/{id}.grading_rules` y, opcionalmente, con overrides
 * por comisión en `courses/{id}.grading_rules_by_commission[comision]`. Lo
 * que no se configura toma el valor por defecto.
 */

const DEFAULT_RULES = Object.freeze({
    /** Asistencia mínima (proporción) para regularizar. */
    min_attendance: 0.75,
    /** Clases tomadas antes de evaluar asistencia (antes no se juzga). */
    min_classes_for_attendance: 3,
    /** 'all' = todos los TPs marcados como obligatorios; o lista de IDs. */
    required_tps: 'all',
    /** TPs obligatorios que la cátedra puede exceptuar por alumno. */
    max_exempt_tps: 1,
    /** Nota mínima para aprobar parciales/recuperatorios y TPs numéricos. */
    partial_pass_grade: 4,
    /** Nota mínima en cada parcial para promocionar. */
    promotion_grade: 7,
    /** Proporción de TPs obligatorios en OK para promocionar. */
    promotion_ok_ratio: 0.8,
    /** Máximo de entregas fuera de término compatible con la promoción. */
    max_late_for_promotion: 1,
    /** Si la nota de promoción puede salir de un recuperatorio. */
    allow_promotion_via_recovery: false,
    /** Margen después del vencimiento, en horas corridas. */
    late_tolerance_hours: 48,
    /** Alerta por inasistencias seguidas (SPEC §1.3). */
    consecutive_absences_alert: 2,
    /** Días desde la publicación de una práctica sin repositorio para alertar. */
    no_repo_alert_days: 7,
    /** Ventana de actividad en Moodle para detectar deserción silenciosa. */
    silent_dropout_days: 7,
});

const RULE_KEYS = Object.keys(DEFAULT_RULES);

function pickRules(source) {
    if (!source || typeof source !== 'object') return {};
    return Object.fromEntries(RULE_KEYS
        .filter((key) => source[key] !== undefined && source[key] !== null)
        .map((key) => [key, source[key]]));
}

/** Reglas efectivas para una comisión: defaults ← curso ← comisión. */
function resolveRules(course, commission) {
    const byCommission = (course && course.grading_rules_by_commission) || {};
    return {
        ...DEFAULT_RULES,
        ...pickRules(course && course.grading_rules),
        ...(commission ? pickRules(byCommission[commission]) : {}),
    };
}

module.exports = { DEFAULT_RULES, RULE_KEYS, resolveRules, pickRules };
