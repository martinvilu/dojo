/**
 * Estado académico de la inscripción antes de recibir entregas (mejora
 * 3.48). Las sincronizaciones de Moodle y SIU Guaraní marcan como
 * 'observador' a quien ya no figura en el padrón oficial (baja, cambio de
 * comisión); el docente también puede hacerlo a mano. Esos estudiantes
 * siguen viendo la cátedra pero no pueden aceptar ni entregar tareas.
 */
const { dojoError } = require('./errors');

const INACTIVE_STATUSES = new Set(['observador', 'inactive', 'dropped', 'rejected', 'suspended']);

async function assertActiveEnrollment(db, courseId, uid) {
    if (!courseId) return;
    const [roster, enrollment] = await Promise.all([
        db.collection('course_roster').doc(`${courseId}_${uid}`).get(),
        db.collection('enrollments').doc(`${uid}_${courseId}`).get()
    ]);
    const status = (roster.exists && roster.data().status) || (enrollment.exists && enrollment.data().status) || null;
    if (status && INACTIVE_STATUSES.has(status)) {
        throw dojoError('ENROLLMENT_INACTIVE', "Tu inscripción en esta cátedra no está activa según el padrón oficial (Moodle / SIU Guaraní): no podés entregar tareas. Consultá con el equipo docente.");
    }
}

module.exports = { INACTIVE_STATUSES, assertActiveEnrollment };
