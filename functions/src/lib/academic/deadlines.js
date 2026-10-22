/**
 * Vencimientos de TPs con margen de tolerancia en horas corridas (plan F2.4).
 *
 * Las fechas `YYYY-MM-DD` de las tareas vencen a las 23:59:59 de Argentina
 * (UTC-3, sin horario de verano): las funciones corren en UTC, así que
 * interpretarlas en la zona del servidor adelantaba el vencimiento 3 horas.
 */

const ARGENTINA_OFFSET = '-03:00';
const HOUR_MS = 60 * 60 * 1000;

/** Instante de vencimiento en ms, o null si la tarea no tiene fecha válida. */
function dueAtMs(dueDate) {
    const text = String(dueDate || '').trim();
    if (!text) return null;
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T23:59:59${ARGENTINA_OFFSET}` : text;
    const ms = new Date(iso).getTime();
    return Number.isNaN(ms) ? null : ms;
}

/** Límite real de entrega: vencimiento + tolerancia + prórroga individual. */
function deadlineWithToleranceMs(dueDate, toleranceHours = 0, extensionHours = 0) {
    const due = dueAtMs(dueDate);
    if (due === null) return null;
    return due + (Number(toleranceHours) || 0) * HOUR_MS + (Number(extensionHours) || 0) * HOUR_MS;
}

/** Firestore Timestamp, Date, ISO o ms → ms (null si no se puede leer). */
function toMs(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'object' && typeof value._seconds === 'number') return value._seconds * 1000;
    const ms = typeof value === 'number' ? value : new Date(value).getTime();
    return Number.isNaN(ms) ? null : ms;
}

/**
 * ¿La entrega es "Fuera de término"? Solo si se entregó después del límite
 * con tolerancia; sin fecha de vencimiento o de entrega no lo es.
 */
function lateness(submittedAt, dueDate, toleranceHours, extensionHours) {
    const submittedMs = toMs(submittedAt);
    const limit = deadlineWithToleranceMs(dueDate, toleranceHours, extensionHours);
    if (submittedMs === null || limit === null || submittedMs <= limit) return { late: false, lateByHours: 0 };
    return { late: true, lateByHours: Math.ceil((submittedMs - limit) / HOUR_MS) };
}

function isPastDeadline(nowMs, dueDate, toleranceHours, extensionHours) {
    const limit = deadlineWithToleranceMs(dueDate, toleranceHours, extensionHours);
    return limit !== null && nowMs > limit;
}

module.exports = { dueAtMs, deadlineWithToleranceMs, lateness, isPastDeadline, toMs, HOUR_MS };
