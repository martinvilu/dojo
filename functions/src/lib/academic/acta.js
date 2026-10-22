/**
 * Acta de cursada (UC-D17, plan F6): snapshot inmutable de la condición
 * final de cada alumno, con hash SHA-256 del contenido.
 *
 * Funciones puras: las usan el cierre (`closeCourse`), la verificación de
 * integridad y el export CSV para SIU Guaraní.
 */
const { createHash } = require('node:crypto');
const { CONDITIONS } = require('./condition');

/**
 * En el acta no hay condiciones provisionales: quien no regularizó queda
 * Libre. Los nombres siguen los estados de cursada de SIU Guaraní.
 */
const SIU_CONDITION = Object.freeze({
    [CONDITIONS.PROMOCIONADO]: 'Promocionado',
    [CONDITIONS.REGULAR]: 'Regular',
    [CONDITIONS.CONDICIONAL]: 'Libre',
    [CONDITIONS.EN_RIESGO]: 'Libre',
    [CONDITIONS.AUSENTE]: 'Ausente',
    [CONDITIONS.BAJA]: 'Abandonó',
});

const round1 = (n) => Math.round(n * 10) / 10;

/** Nota de cursada: promedio de la mejor nota de cada parcial (solo promocionados). */
function finalGrade(result) {
    if (result.condition !== CONDITIONS.PROMOCIONADO) return null;
    const bests = (result.partials || []).map((p) => p.best).filter((b) => typeof b === 'number');
    if (bests.length === 0) return null;
    return round1(bests.reduce((a, b) => a + b, 0) / bests.length);
}

/** Fila del acta a partir del resultado de `computeAcademicCondition` + datos del alumno. */
function actaRow(result) {
    return {
        student_id: result.student_id,
        matricula: result.matricula_unrn || '',
        full_name: result.full_name || result.email || '',
        commission: result.commission || '',
        condition: result.condition,
        siu_condition: SIU_CONDITION[result.condition] || result.condition,
        final_grade: finalGrade(result),
        attendance_ratio: result.attendance && result.attendance.ratio !== null && result.attendance.ratio !== undefined
            ? Math.round(result.attendance.ratio * 1000) / 1000 : null,
        tps_delivered: result.tps ? result.tps.delivered : 0,
        tps_required: result.tps ? result.tps.required : 0,
        partials: (result.partials || []).map((p) => ({ label: p.label, best: p.best })),
        reasons: result.reasons || [],
    };
}

/** JSON con claves ordenadas: el mismo contenido siempre da el mismo hash. */
function canonicalJson(value) {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
    }
    return JSON.stringify(value === undefined ? null : value);
}

/** Hash del acta: curso, versión, reglas y filas ordenadas por alumno. */
function hashActa({ courseId, version, rules, rows }) {
    const sorted = [...rows].sort((a, b) => a.student_id.localeCompare(b.student_id));
    return createHash('sha256').update(canonicalJson({ courseId, version, rules, rows: sorted })).digest('hex');
}

function csvCell(value) {
    const s = value === null || value === undefined ? '' : String(value);
    // Evita inyección de fórmulas al abrir el CSV en una planilla.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[;"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * CSV para cargar en SIU Guaraní (separador `;`, coma decimal, BOM para
 * Excel). Las columnas deben revisarse contra la plantilla de importación
 * de la UNRN. El hash del acta viaja en el nombre del archivo, no adentro,
 * para no agregar filas que el importador no espera.
 */
function toSiuCsv({ closedAt, rows }) {
    const date = closedAt ? new Date(closedAt).toISOString().slice(0, 10) : '';
    const header = ['legajo', 'apellido_y_nombre', 'comision', 'condicion', 'nota', 'fecha', 'observaciones'];
    const sorted = [...rows].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'es'));
    const lines = sorted.map((r) => [
        r.matricula,
        r.full_name,
        r.commission,
        r.siu_condition,
        r.final_grade === null ? '' : String(r.final_grade).replace('.', ','),
        date,
        r.matricula ? '' : 'Sin matrícula: completar antes de cargar',
    ].map(csvCell).join(';'));
    return `\uFEFF${header.join(';')}\n${lines.join('\n')}\n`;
}

module.exports = { SIU_CONDITION, finalGrade, actaRow, canonicalJson, hashActa, toSiuCsv };
