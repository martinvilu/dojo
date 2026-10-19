/**
 * Proyecciones de perfiles para listados (mejora 3.46): cada listado
 * devuelve solo los campos que la UI consume, en lugar del documento de
 * perfil completo (que incluye correos secundarios, estado de cuenta y
 * otros datos internos).
 */

/** Datos visibles para cualquier miembro del curso (compañeros, docentes). */
const PUBLIC_PROFILE_FIELDS = ['full_name', 'email', 'github_user', 'avatar_url', 'role'];

/** Datos de un estudiante visibles para el equipo docente de su curso. */
const STAFF_STUDENT_FIELDS = [
    ...PUBLIC_PROFILE_FIELDS,
    'matricula_unrn', 'cohorte', 'commissions', 'github_username', 'contact_email', 'account_status', 'xp_total'
];

function pickFields(data, fields) {
    if (!data) return null;
    const out = {};
    for (const field of fields) {
        if (data[field] !== undefined) out[field] = data[field];
    }
    return out;
}

const publicProfile = (data) => pickFields(data, PUBLIC_PROFILE_FIELDS);
const staffStudentProfile = (data) => pickFields(data, STAFF_STUDENT_FIELDS);

module.exports = { PUBLIC_PROFILE_FIELDS, STAFF_STUDENT_FIELDS, pickFields, publicProfile, staffStudentProfile };
