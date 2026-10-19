const logger = require("firebase-functions/logger");
const { projectCourse } = require('./courses');
const { dojoError } = require('../../lib/errors');
const { ROLES, syncRoleClaim } = require('../../lib/claims');
const { encryptSecret, isEncrypted } = require('../../lib/secretBox');

async function approveUser(payload, context) {
    const { db, getMyProfile } = context;
    const { targetUid } = payload;
    const myProfile = await getMyProfile();
    if (myProfile.role !== 'admin') throw dojoError('ADMIN_ONLY', "Solo admins pueden aprobar usuarios");
    
    await db.collection('profiles').doc(targetUid).update({
        account_status: 'approved',
        email_domain_blocked: false
    });
    return { success: true };
}

async function updateUserRole(payload, context) {
    const { db, getMyProfile, admin } = context;
    const { targetUid, newRole } = payload;
    const myProfile = await getMyProfile();
    if (myProfile.role !== 'admin') throw dojoError('ADMIN_ONLY', "Solo admins pueden cambiar roles de usuario");
    if (!['admin', 'teacher', 'student'].includes(newRole)) throw dojoError('INVALID_ARGUMENT', "Rol inválido");
    
    const before = await db.collection('profiles').doc(targetUid).get();
    await db.collection('profiles').doc(targetUid).update({
        role: newRole
    });
    await syncClaimSafely(admin, targetUid, newRole, before.exists ? before.data().role : undefined);
    return { success: true };
}

// Campos del perfil que un admin puede editar desde Usuarios.
const ADMIN_EDITABLE_PROFILE_FIELDS = ['full_name', 'role', 'matricula_unrn', 'cohorte', 'commission', 'account_status'];

async function syncClaimSafely(admin, uid, role, previousRole) {
    try {
        await syncRoleClaim(admin.auth(), uid, role, { previousRole });
    } catch (e) {
        // El perfil ya cambió; el claim se corrige en el próximo login.
        logger.warn('[admin] no se pudo actualizar el custom claim de rol:', uid, e.message);
    }
}

async function updateUserProfile(payload, context) {
    const { db, admin } = context;
    const data = payload.data;
    if (!payload.userId || !data || typeof data !== 'object' || Array.isArray(data)) {
        throw dojoError('INVALID_ARGUMENT', "Datos de perfil inválidos");
    }
    const unknown = Object.keys(data).filter((k) => !ADMIN_EDITABLE_PROFILE_FIELDS.includes(k));
    if (unknown.length) throw dojoError('INVALID_ARGUMENT', `Campos no editables: ${unknown.join(', ')}`);
    if (data.role !== undefined && !ROLES.includes(data.role)) throw dojoError('INVALID_ARGUMENT', "Rol inválido");
    if (data.account_status !== undefined && !['pending', 'approved'].includes(data.account_status)) {
        throw dojoError('INVALID_ARGUMENT', "Estado de cuenta inválido");
    }
    const before = await db.collection('profiles').doc(payload.userId).get();
    await db.collection('profiles').doc(payload.userId).update(data);
    if (data.role !== undefined) {
        await syncClaimSafely(admin, payload.userId, data.role, before.exists ? before.data().role : undefined);
    }
    return { success: true };
}

async function getAdminUsers(payload, context) {
    const { db } = context;
    const snap = await db.collection('profiles').get();
    const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    users.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
    return users;
}

async function getAdminCourses(payload, context) {
    const { db } = context;
    const coursesSnap = await db.collection('courses').get();
    const courses = [];
    for (let doc of coursesSnap.docs) {
        const c = { id: doc.id, ...projectCourse(doc.data()) };
        const raw = doc.data();
        if (raw.deleted_at) {
            const toIso = (v) => (v && typeof v.toDate === 'function' ? v.toDate() : new Date(v)).toISOString();
            c.deleted_at = toIso(raw.deleted_at);
            c.purge_after = raw.purge_after ? toIso(raw.purge_after) : null;
        }
        const teachersSnap = await db.collection('course_teachers').where('course_id', '==', c.id).get();
        c.course_teachers = [];
        for (let tdoc of teachersSnap.docs) {
            const tdata = tdoc.data();
            const profSnap = await db.collection('profiles').doc(tdata.teacher_id).get();
            c.course_teachers.push({
                teacher_id: tdata.teacher_id,
                profiles: profSnap.data()
            });
        }
        courses.push(c);
    }
    courses.sort((a, b) => {
        const tA = a.created_at ? (a.created_at.toDate ? a.created_at.toDate().getTime() : new Date(a.created_at).getTime()) : 0;
        const tB = b.created_at ? (b.created_at.toDate ? b.created_at.toDate().getTime() : new Date(b.created_at).getTime()) : 0;
        return tB - tA;
    });
    return courses;
}

async function getGlobalSettings(payload, context) {
    const { db } = context;
    const snap = await db.collection('globals').doc('settings').get();
    return snap.exists ? snap.data() : {};
}

const DOMAIN_RE = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/;

/** Normaliza la lista de dominios de correo habilitados (mejora 3.20). */
function normalizeDomains(value) {
    const list = Array.isArray(value) ? value : String(value || '').split(/[,\s]+/);
    const domains = [...new Set(list.map((d) => String(d).trim().toLowerCase().replace(/^@/, '')).filter(Boolean))];
    const invalid = domains.filter((d) => !DOMAIN_RE.test(d) || d.length > 253);
    if (invalid.length) throw dojoError('INVALID_ARGUMENT', `Dominios inválidos: ${invalid.join(', ')}`);
    if (domains.length > 20) throw dojoError('INVALID_ARGUMENT', "Máximo 20 dominios.");
    return domains;
}

async function saveGlobalSettings(payload, context) {
    const { db, getMyProfile } = context;
    const myProfile = await getMyProfile();
    if (myProfile.role !== 'admin') throw dojoError('ADMIN_ONLY', 'Solo los administradores pueden guardar la configuración global');
    const update = {};
    if (payload.globalCalendarIcsUrl !== undefined) {
        const url = String(payload.globalCalendarIcsUrl || '').trim();
        if (url && !/^https:\/\/\S+$/.test(url)) throw dojoError('INVALID_ARGUMENT', "La URL del calendario debe empezar con https://");
        update.globalCalendarIcsUrl = url;
    }
    if (payload.allowed_email_domains !== undefined) {
        update.allowed_email_domains = normalizeDomains(payload.allowed_email_domains);
    }
    await db.collection('globals').doc('settings').set(update, { merge: true });
    return { success: true, ...update };
}

async function getAdminCourseDetails(payload, context) {
    const { db } = context;
    const courseId = payload.courseId;
    const cSnap = await db.collection('courses').doc(courseId).get();
    if (!cSnap.exists) throw dojoError('COURSE_NOT_FOUND', "Course not found");
    const course = cSnap.data();
    course.id = courseId;
    
    // Get teachers
    const tSnap = await db.collection('course_teachers').where('course_id', '==', courseId).get();
    course.teachers = [];
    for (let doc of tSnap.docs) {
        const tdata = doc.data();
        const pSnap = await db.collection('profiles').doc(tdata.teacher_id).get();
        course.teachers.push(pSnap.data());
    }
    
    // Get students
    const rSnap = await db.collection('course_roster').where('course_id', '==', courseId).get();
    course.students = [];
    for (let doc of rSnap.docs) {
        const sdata = doc.data();
        const pSnap = await db.collection('profiles').doc(sdata.student_id).get();
        course.students.push(pSnap.data());
    }

    // Get assignments
    const aSnap = await db.collection('assignments').where('course_id', '==', courseId).get();
    course.assignments = aSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    return course;
}

async function deleteUser(payload, context) {
    const { db, admin, getMyProfile } = context;
    const { targetUid } = payload;
    const myProfile = await getMyProfile();
    if (myProfile.role !== 'admin') throw dojoError('ADMIN_ONLY', "Solo los administradores pueden borrar usuarios");

    // 1. Delete from Firebase Auth
    try {
        await admin.auth().deleteUser(targetUid);
    } catch (authErr) {
        logger.warn("User did not exist in Firebase Auth or failed to delete:", authErr.message);
    }

    // 2. Delete profile document from Firestore
    await db.collection('profiles').doc(targetUid).delete();

    // 3. Delete from course_roster (student enrollments)
    const rosterSnaps = await db.collection('course_roster').where('student_id', '==', targetUid).get();
    const batch = db.batch();
    rosterSnaps.docs.forEach(doc => {
        batch.delete(doc.ref);
    });

    // 4. Delete from course_teachers (teacher assignments)
    const teacherSnaps = await db.collection('course_teachers').where('teacher_id', '==', targetUid).get();
    teacherSnaps.docs.forEach(doc => {
        batch.delete(doc.ref);
    });

    await batch.commit();
    return { success: true };
}

/**
 * Cifra los tokens de GitHub guardados en texto plano antes de la mejora
 * 3.13. Idempotente: los ya cifrados se saltean.
 */
async function encryptStoredSecrets(payload, context) {
    const { db } = context;
    if (!process.env.TOKEN_ENCRYPTION_KEY) {
        throw dojoError('FAILED_PRECONDITION', "Configurá TOKEN_ENCRYPTION_KEY en Cloud Functions antes de migrar los tokens.");
    }
    const snap = await db.collection('courses').get();
    let encrypted = 0;
    for (const doc of snap.docs) {
        const token = doc.data().github_token;
        if (token && !isEncrypted(token)) {
            await doc.ref.update({ github_token: encryptSecret(token) });
            encrypted++;
        }
    }
    return { success: true, encrypted, scanned: snap.size };
}

module.exports = {
    encryptStoredSecrets,
    normalizeDomains,
    approveUser,
    updateUserRole,
    updateUserProfile,
    getAdminUsers,
    getAdminCourses,
    getGlobalSettings,
    saveGlobalSettings,
    getAdminCourseDetails,
    deleteUser
};
