/**
 * Rango Ninja (SPEC §1.1, plan F0.2): XP, nivel, rango y medallas.
 *
 *   XP = asistencias·10 + entregas·50 + Σ nota·5 + comentarios·10 + soluciones·100
 *
 * `Σ nota` incluye las notas numéricas de TPs y de parciales/recuperatorios
 * (decisión 3); las conceptuales no suman. Es una función pura sin I/O: la
 * usan la tarjeta del alumno y el backend (`getMyXp`, `getXpLogs`), así que
 * no hace falta escribir XP en ningún lado.
 */

const POINTS = Object.freeze({ attendance: 10, submission: 50, gradeFactor: 5, comment: 10, solution: 100 });
const XP_PER_LEVEL = 100;
const PRESENT = ['present', 'late'];

function numericGrade(value) {
    if (value === undefined || value === null || String(value).trim() === '') return null;
    const n = Number(String(value).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
}

function rankFor(level) {
    if (level >= 5) return 'Jōnin';
    if (level >= 3) return 'Chūnin';
    return 'Genin';
}

const isSolution = (c) => Boolean(c && (c.is_solution || c.is_best_answer));

/**
 * Eventos que suman XP para un alumno, en el orden de las fuentes.
 *
 * Los documentos llegan tal como están en Firestore; solo se leen los campos
 * nombrados en cada caso.
 *
 * @typedef {Record<string, any>} Doc
 * @typedef {{ action: string, points: number, description: string, at: unknown, grade?: number }} XpEvent
 *
 * @param {object} input
 * @param {string} input.studentId
 * @param {Doc[]} [input.attendance]        documentos `class_{n}` del curso ({ classNumber, records })
 * @param {Doc[]} [input.submissions]       entregas del alumno, una por TP ({ assignment_id, grade })
 * @param {Doc[]} [input.assessmentGrades]  notas de parciales ({ grade, absent, label })
 * @param {Doc[]} [input.comments]          comentarios del foro ({ user_id, is_solution, classNumber })
 * @param {Record<string, string>} [input.assignmentTitles]  id → título, solo para las descripciones
 * @returns {XpEvent[]}
 */
function xpEvents({ studentId, attendance = [], submissions = [], assessmentGrades = [], comments = [], assignmentTitles = {} }) {
    /** @type {XpEvent[]} */
    const events = [];
    for (const doc of attendance) {
        const status = doc && doc.records ? doc.records[studentId] : undefined;
        if (PRESENT.includes(status)) {
            events.push({ action: 'asistencia', points: POINTS.attendance, description: `Asistencia en Clase ${doc.classNumber}`, at: doc.updated_at || null });
        }
    }
    for (const sub of submissions) {
        if (!sub || (sub.student_id && sub.student_id !== studentId)) continue;
        const title = assignmentTitles[sub.assignment_id] || 'TP';
        events.push({ action: 'entrega', points: POINTS.submission, description: `Entrega de ${title}`, at: sub.created_at || sub.submitted_at || null });
        const grade = numericGrade(sub.grade);
        if (grade !== null) {
            events.push({ action: 'nota', points: grade * POINTS.gradeFactor, description: `Nota ${grade} en ${title}`, at: sub.graded_at || null, grade });
        }
    }
    for (const g of assessmentGrades) {
        if (!g || g.absent) continue;
        const grade = numericGrade(g.grade);
        if (grade !== null) {
            events.push({ action: 'nota', points: grade * POINTS.gradeFactor, description: `Nota ${grade} en ${g.label || 'parcial'}`, at: g.graded_at || g.updated_at || null, grade });
        }
    }
    for (const c of comments) {
        if (!c || c.user_id !== studentId) continue;
        events.push({ action: 'comentario', points: POINTS.comment, description: `Comentario en el foro de la Clase ${c.classNumber}`, at: c.created_at || null });
        if (isSolution(c)) {
            events.push({ action: 'solucion', points: POINTS.solution, description: `Solución oficial en la Clase ${c.classNumber}`, at: c.created_at || null });
        }
    }
    return events;
}

/**
 * Resumen del Rango Ninja. Recibe lo mismo que `xpEvents`.
 * Medallas: Maestro de Chakra (promedio ≥ 9), Asistencia Perfecta (≥ 3 clases
 * registradas, todas presente/tarde), Ninja Activo (≥ 3 comentarios) y
 * Solucionador (al menos una solución oficial).
 *
 * @param {Parameters<typeof xpEvents>[0]} input
 */
function computeXp(input) {
    const events = xpEvents(input);
    const totalXp = Math.round(events.reduce((sum, e) => sum + e.points, 0));
    const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;

    const grades = events.filter((e) => e.action === 'nota').map((e) => Number(e.grade));
    const avgGrade = grades.length ? grades.reduce((a, b) => a + b, 0) / grades.length : null;
    const recorded = (input.attendance || []).filter((d) => d && d.records && d.records[input.studentId]).length;
    const present = events.filter((e) => e.action === 'asistencia').length;
    const comments = events.filter((e) => e.action === 'comentario').length;
    const solutions = events.filter((e) => e.action === 'solucion').length;

    const breakdown = {};
    for (const e of events) breakdown[e.action] = (breakdown[e.action] || 0) + e.points;

    return {
        totalXp,
        level,
        levelProgress: totalXp % XP_PER_LEVEL,
        rank: rankFor(level),
        breakdown,
        badges: {
            chakraMaster: avgGrade !== null && avgGrade >= 9,
            perfectAttendance: recorded >= 3 && present === recorded,
            activeNinja: comments >= 3,
            solver: solutions > 0,
        },
    };
}

module.exports = { computeXp, xpEvents, rankFor, isSolution, POINTS, XP_PER_LEVEL };
