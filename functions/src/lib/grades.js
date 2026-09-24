/**
 * Validación y normalización de calificaciones (escala 0-10 de la UNRN).
 *
 * Se aceptan:
 *   - notas numéricas entre 0 y 10, con punto o coma decimal ("7,5" -> "7.5"),
 *     redondeadas a dos decimales;
 *   - notas conceptuales cortas formadas solo por letras (ej. "Aprobado",
 *     "Ausente", "Promocionado"), que el docente usa en tareas no numéricas;
 *   - vacío, para borrar la nota.
 * Cualquier otro valor (negativos, "15", "9/10", texto con símbolos) se
 * rechaza para que no llegue a los registros oficiales ni a Moodle.
 */

const MAX_GRADE = 10;
const MAX_FEEDBACK_LENGTH = 5000;
const NUMERIC_RE = /^[+-]?(\d+([.,]\d+)?|[.,]\d+)$/;
const QUALITATIVE_RE = /^\p{L}[\p{L} ]{0,39}$/u;
// Palabras que parseFloat/Number interpretan como números no finitos.
const RESERVED_WORDS = new Set(['nan', 'infinity']);

const GRADE_ERROR = `La nota debe ser un número entre 0 y ${MAX_GRADE} o una calificación conceptual (ej. "Aprobado").`;

/**
 * @returns {{ ok: true, value: string } | { ok: false, error: string }}
 */
function normalizeGrade(raw) {
    if (raw === null || raw === undefined) return { ok: true, value: '' };
    if (typeof raw === 'number') raw = String(raw);
    if (typeof raw !== 'string') return { ok: false, error: GRADE_ERROR };

    const text = raw.trim();
    if (text === '') return { ok: true, value: '' };

    if (NUMERIC_RE.test(text)) {
        const value = Number(text.replace(',', '.'));
        if (!Number.isFinite(value) || value < 0 || value > MAX_GRADE) {
            return { ok: false, error: GRADE_ERROR };
        }
        return { ok: true, value: String(Math.round(value * 100) / 100) };
    }

    if (QUALITATIVE_RE.test(text) && !RESERVED_WORDS.has(text.toLowerCase())) {
        return { ok: true, value: text.replace(/\s+/g, ' ') };
    }
    return { ok: false, error: GRADE_ERROR };
}

/** Normaliza la devolución del docente: texto plano acotado. */
function normalizeFeedback(raw) {
    if (raw === null || raw === undefined) return '';
    return String(raw).slice(0, MAX_FEEDBACK_LENGTH);
}

/**
 * Nota numérica en escala 0..1 para el outcome service de LTI, o null si la
 * nota es conceptual o está vacía (no hay equivalente numérico que enviar).
 */
function gradeToOutcomeScore(grade) {
    const normalized = normalizeGrade(grade);
    if (!normalized.ok || normalized.value === '' || !NUMERIC_RE.test(normalized.value)) return null;
    return Number(normalized.value) / MAX_GRADE;
}

module.exports = { normalizeGrade, normalizeFeedback, gradeToOutcomeScore, MAX_GRADE, MAX_FEEDBACK_LENGTH };
