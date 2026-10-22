/**
 * URLs semánticas sin datos personales (SPEC §2.3, plan F5):
 *
 *   /{asignatura}/{anio}/{cuatrimestre}/{comision}/{vista}
 *   /{asignatura}/{anio}/{cuatrimestre}/{comision}/estudiantes/{st_…}[/practicas/{tp}|/asistencias]
 *   /{asignatura}/{anio}/{cuatrimestre}/{comision}/admin/configuracion
 *
 * Sin dependencias de Node: lo importan también los componentes de Next.
 */

const TERMS = Object.freeze(['1c', '2c', 'anual', 'verano']);
const ALL_COMMISSIONS = 'todas';
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PUBLIC_ID_RE = /^st_[0-9a-f]{10}$/;

/** Vista de la URL -> subpestaña del dashboard. */
const VIEW_TO_SUBTAB = Object.freeze({
    resumen: 'overview',
    planilla: 'students',
    cronograma: 'schedules',
    tareas: 'assignments',
    cursada: 'academic',
    avisos: 'announcements',
    tutorias: 'tutorias',
    grupos: 'study_groups',
    correos: 'emails',
    docentes: 'teachers',
});
const SUBTAB_TO_VIEW = Object.freeze(Object.fromEntries(Object.entries(VIEW_TO_SUBTAB).map(([v, s]) => [s, v])));

function slugify(text, max = 60) {
    return String(text || '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, max)
        .replace(/-+$/g, '');
}

function courseRouteKey(slug, year, term) {
    return `${slug}__${year}__${term}`;
}

/** Cuatrimestre por defecto a partir de una fecha de inicio. */
function termFor(date) {
    const month = date.getMonth() + 1;
    return month <= 7 ? '1c' : '2c';
}

function hasRoute(course) {
    return Boolean(course && course.route_slug && course.route_year && course.route_term);
}

/**
 * Ruta del dashboard para un curso. Devuelve null si el curso todavía no
 * tiene asignatura/año/cuatrimestre configurados (se usan los query params).
 *
 * @param {any} course
 * @param {{ commission?: string | null, subTab?: string, studentPublicId?: string, practica?: string, asistencias?: boolean }} [opts]
 */
function buildCoursePath(course, { commission, subTab, studentPublicId, practica, asistencias } = {}) {
    if (!hasRoute(course)) return null;
    const base = `/${course.route_slug}/${course.route_year}/${course.route_term}/${commission ? slugify(commission) : ALL_COMMISSIONS}`;
    if (studentPublicId) {
        const student = `${base}/estudiantes/${studentPublicId}`;
        if (practica) return `${student}/practicas/${practica}`;
        return asistencias ? `${student}/asistencias` : student;
    }
    if (subTab === 'settings') return `${base}/admin/configuracion`;
    return `${base}/${(subTab && SUBTAB_TO_VIEW[subTab]) || 'resumen'}`;
}

module.exports = {
    TERMS, ALL_COMMISSIONS, SLUG_RE, PUBLIC_ID_RE, VIEW_TO_SUBTAB, SUBTAB_TO_VIEW,
    slugify, courseRouteKey, termFor, hasRoute, buildCoursePath,
};
