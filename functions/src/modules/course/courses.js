const logger = require('firebase-functions/logger');
const { randomBytes } = require('node:crypto');
const { isCourseStaff } = require('../../authz');
const { dojoError } = require('../../lib/errors');
const { publicProfile, staffStudentProfile } = require('../../lib/projections');
const { PURGE_AFTER_DAYS, isDeleted } = require('../../lib/softDelete');
const { rosterChecksum, shouldSyncRoster, saveRosterChecksum } = require('../../lib/rosterChecksum');
const { syncRoleClaim } = require('../../lib/claims');
const { encryptSecret } = require('../../lib/secretBox');

async function getCourseDetails(payload, context) {
    const { uid, db, getMyProfile } = context;
    const courseId = payload.courseId;
    const rosterSnap = await db.collection('course_roster').doc(`${courseId}_${uid}`).get();
    const teacherSnap = await db.collection('course_teachers').doc(`${courseId}_${uid}`).get();
    const enrollSnap = await db.collection('enrollments').where('course_id', '==', courseId).where('student_id', '==', uid).get();
    const myProfile = await getMyProfile();
    
    if (!rosterSnap.exists && !teacherSnap.exists && enrollSnap.empty && myProfile.role !== 'admin') {
        throw dojoError('NOT_COURSE_MEMBER', "No tienes acceso a este curso");
    }
    
    const cSnap = await db.collection('courses').doc(courseId).get();
    if (!cSnap.exists || (isDeleted(cSnap.data()) && myProfile.role !== 'admin')) throw dojoError('COURSE_NOT_FOUND', "Curso no encontrado");
    
    const data = cSnap.data();
    if (!teacherSnap.exists && myProfile.role !== 'admin') {
        // Estudiantes: sin credenciales, sin sync_secret (habilita exportar e
        // importar notas) ni códigos de invitación docente (otorgan el rol).
        await ensureCalendarSecret(db, courseId, data);
        return { id: cSnap.id, ...projectCourseForStudent(data) };
    }

    if (!data.sync_secret) {
        data.sync_secret = generateSyncSecret();
        await db.collection('courses').doc(courseId).update({
            sync_secret: data.sync_secret
        });
    }
    
    const courseRole = myProfile.role === 'admin' && !teacherSnap.exists ? 'admin' : ((teacherSnap.data() || {}).role === 'ayudante' ? 'ayudante' : 'titular');
    const result = { id: cSnap.id, ...withoutCredentials(data), course_role: courseRole };
    if (courseRole === 'ayudante') {
        delete result.teacher_invite_code;
        delete result.assistant_invite_code;
    }
    return result;
}

async function enrollCourse(payload, context) {
    const { uid, db, admin } = context;
    if (typeof payload.code !== 'string' || !/^[A-Za-z0-9-]{4,20}$/.test(payload.code.trim())) {
        throw dojoError('INVALID_ARGUMENT', "Código de invitación inválido");
    }
    const code = payload.code.trim().toUpperCase();
    const isActive = (s) => !s.empty && !isDeleted(s.docs[0].data());
    const snap = await db.collection('courses').where('invite_code', '==', code).get();
    if (isActive(snap)) {
        const courseId = snap.docs[0].id;
        // Student enrolls with pending approval status (requirement 4)
        await db.collection('course_roster').doc(`${courseId}_${uid}`).set({
            course_id: courseId,
            student_id: uid,
            status: 'pending',
            enrolled_at: admin.firestore.FieldValue.serverTimestamp()
        });
        await db.collection('enrollments').doc(`${uid}_${courseId}`).set({
            course_id: courseId,
            student_id: uid,
            status: 'pending',
            enrolled_at: admin.firestore.FieldValue.serverTimestamp()
        });
        return { success: true, message: "Solicitud de inscripción enviada. Pendiente de aprobación por el docente." };
    }

    const tSnap = await db.collection('courses').where('teacher_invite_code', '==', code).get();
    if (isActive(tSnap)) {
        const courseId = tSnap.docs[0].id;
        await db.collection('course_teachers').doc(`${courseId}_${uid}`).set({
            course_id: courseId,
            teacher_id: uid,
            role: 'titular'
        });
        await db.collection('profiles').doc(uid).update({ role: 'teacher', account_status: 'approved' });
        await syncRoleClaim(admin.auth(), uid, 'teacher').catch(() => {});
        return { success: true, claimsRefreshRequired: true };
    }
    
    const aSnap = await db.collection('courses').where('assistant_invite_code', '==', code).get();
    if (isActive(aSnap)) {
        const courseId = aSnap.docs[0].id;
        await db.collection('course_teachers').doc(`${courseId}_${uid}`).set({
            course_id: courseId,
            teacher_id: uid,
            role: 'ayudante'
        });
        await db.collection('profiles').doc(uid).update({ role: 'teacher', account_status: 'approved' });
        await syncRoleClaim(admin.auth(), uid, 'teacher').catch(() => {});
        return { success: true, claimsRefreshRequired: true };
    }
    
    throw dojoError('INVALID_ARGUMENT', "Código de invitación inválido");
}

async function createCourse(payload, context) {
    const { uid, db, admin } = context;
    const ref = await db.collection('courses').add({
        name: payload.name,
        github_org: payload.github_org,
        invite_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
        teacher_invite_code: 'T-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
        assistant_invite_code: 'A-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
        sync_secret: generateSyncSecret(),
        created_by: uid,
        created_at: admin.firestore.FieldValue.serverTimestamp()
    });
    return { id: ref.id };
}

async function deleteCourse(payload, context) {
    const { db } = context;
    const { courseId } = payload;
    if (!courseId) throw dojoError('INVALID_ARGUMENT', "ID de cátedra requerido");
    const ref = db.collection('courses').doc(courseId);
    const snap = await ref.get();
    if (!snap.exists) throw dojoError('COURSE_NOT_FOUND', "Curso no encontrado");
    // Borrado lógico (mejora 3.21): se purga en cascada pasado el plazo.
    const now = Date.now();
    await ref.update({
        deleted_at: new Date(now),
        deleted_by: context.uid,
        purge_after: new Date(now + PURGE_AFTER_DAYS * 24 * 60 * 60 * 1000)
    });
    return { success: true, purgeAfterDays: PURGE_AFTER_DAYS };
}

async function restoreCourse(payload, context) {
    const { db, admin } = context;
    const { courseId } = payload;
    if (!courseId) throw dojoError('INVALID_ARGUMENT', "ID de cátedra requerido");
    const ref = db.collection('courses').doc(courseId);
    const snap = await ref.get();
    if (!snap.exists) throw dojoError('COURSE_NOT_FOUND', "Curso no encontrado");
    if (!isDeleted(snap.data())) return { success: true };
    const remove = admin.firestore.FieldValue.delete();
    await ref.update({ deleted_at: remove, deleted_by: remove, purge_after: remove });
    return { success: true };
}

async function updateCourseName(payload, context) {
    const { db } = context;
    await db.collection('courses').doc(payload.courseId).update({ name: payload.name });
    return { success: true };
}

async function getCourseTeachers(payload, context) {
    const { db } = context;
    const tSnap = await db.collection('course_teachers').where('course_id', '==', payload.courseId).get();
    const teachers = [];
    for (let doc of tSnap.docs) {
        const t = doc.data();
        const p = await db.collection('profiles').doc(t.teacher_id).get();
        teachers.push({ ...t, profiles: publicProfile(p.exists ? p.data() : null) });
    }
    return teachers;
}

async function assignTeacher(payload, context) {
    const { db } = context;
    await db.collection('course_teachers').doc(`${payload.courseId}_${payload.teacherId}`).set({
        course_id: payload.courseId,
        teacher_id: payload.teacherId
    });
    return { success: true };
}

async function removeTeacher(payload, context) {
    const { db } = context;
    await db.collection('course_teachers').doc(`${payload.courseId}_${payload.teacherId}`).delete();
    return { success: true };
}


// Campos seguros para entregar al cliente en listados de cursos.
// Excluye credenciales (github_token, tokens Moodle) que no deben
// salir nunca del backend: el docente solo los edita, jamás los lee.
const COURSE_PUBLIC_FIELDS = [
    'name', 'sync_secret', 'calendar_secret', 'start_date', 'duration_weeks',
    'schedules', 'class_instances', 'commissions', 'commissions_mapping',
    'cover_text', 'moodle_enabled', 'external_calendars', 'created_at',
    'archived', 'invite_code'
];

// Credenciales que el backend usa pero nunca devuelve: el docente puede
// reemplazarlas, no leerlas.
const CREDENTIAL_FIELDS = ['github_token'];

function withoutCredentials(data) {
    const out = { ...data };
    for (const field of CREDENTIAL_FIELDS) delete out[field];
    out.has_github_token = Boolean(data && data.github_token);
    return out;
}

// Campos que el equipo docente puede modificar con updateCourseSettings.
const EDITABLE_SETTINGS = {
    cover_text: (v) => typeof v === 'string' && v.length <= 5000,
    duration_weeks: (v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 52),
    start_date: (v) => v === '' || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)),
    external_calendars: (v) => Array.isArray(v) && v.length <= 10 && v.every((u) => typeof u === 'string' && /^https:\/\//.test(u) && u.length <= 2048),
    github_token: (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 255,
    moodle_enabled: (v) => typeof v === 'boolean',
    schedules: (v) => Array.isArray(v) && v.length <= 50,
    commissions: (v) => Array.isArray(v) && v.length <= 50 && v.every((c) => typeof c === 'string' && c.length <= 60),
    commissions_mapping: (v) => v !== null && typeof v === 'object' && !Array.isArray(v),
    class_instances: (v) => Array.isArray(v) && v.length <= 400,
};

function sanitizeCourseSettings(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw dojoError('INVALID_ARGUMENT', "Datos de configuración inválidos");
    }
    const update = {};
    for (const [key, value] of Object.entries(data)) {
        // Un token vacío significa "conservar el actual".
        if (key === 'github_token' && (value === '' || value === undefined || value === null)) continue;
        if (!Object.prototype.hasOwnProperty.call(EDITABLE_SETTINGS, key)) {
            throw dojoError('INVALID_ARGUMENT', `El campo "${key}" no se puede modificar desde los ajustes.`);
        }
        if (!EDITABLE_SETTINGS[key](value)) {
            throw dojoError('INVALID_ARGUMENT', `Valor inválido para "${key}".`);
        }
        // Los tokens se guardan cifrados (mejora 3.13).
        update[key] = key === 'github_token' ? encryptSecret(value.trim(), { logger }) : value;
    }
    return update;
}

// Los estudiantes no reciben sync_secret: ese token también autoriza la
// exportación CSV de notas/asistencia y la importación de notas. Para el
// feed iCal reciben calendar_secret, que solo habilita el calendario.
const STUDENT_COURSE_FIELDS = COURSE_PUBLIC_FIELDS.filter(field => field !== 'sync_secret');



// Tokens de suscripción de 32 hex chars: resistentes a fuerza bruta
// (los viejos de 8 chars siguen válidos hasta que se regeneren).
function generateSyncSecret() {
    return randomBytes(16).toString('hex').toUpperCase();
}

function pickFields(data, fields) {
    const projected = {};
    for (const field of fields) {
        if (data[field] !== undefined) projected[field] = data[field];
    }
    return projected;
}

function projectCourse(data) {
    return pickFields(data, COURSE_PUBLIC_FIELDS);
}

function projectCourseForStudent(data) {
    return pickFields(data, STUDENT_COURSE_FIELDS);
}

/** Genera (una única vez) el token de solo lectura del feed iCal del curso. */
async function ensureCalendarSecret(db, courseId, data) {
    if (data.calendar_secret) return data.calendar_secret;
    data.calendar_secret = generateSyncSecret();
    await db.collection('courses').doc(courseId).update({ calendar_secret: data.calendar_secret });
    return data.calendar_secret;
}

async function getTeacherCourses(payload, context) {
    const { uid, db } = context;
    const snap = await db.collection('course_teachers').where('teacher_id', '==', uid).get();
    const courses = [];
    for (let doc of snap.docs) {
        const cSnap = await db.collection('courses').doc(doc.data().course_id).get();
        if (cSnap.exists && !isDeleted(cSnap.data())) {
            courses.push({ id: cSnap.id, course_role: doc.data().role || 'titular', ...projectCourse(cSnap.data()) });
        }
    }
    return courses;
}

async function getCourseSettings(payload, context) {
    const { uid, db } = context;
    const courseId = payload.courseId;
    const profileSnap = await db.collection('profiles').doc(uid).get();
    const isSysAdmin = profileSnap.exists && profileSnap.data().role === 'admin';
    let isAssistant = false;
    if (!isSysAdmin) {
        const accessSnap = await db.collection('course_teachers').doc(`${courseId}_${uid}`).get();
        if (!accessSnap.exists) throw dojoError('NOT_COURSE_MEMBER', "No tienes acceso a este curso");
        isAssistant = accessSnap.data().role === 'ayudante';
    }
    
    const cSnap = await db.collection('courses').doc(courseId).get();
    let data = cSnap.data();
    let needsUpdate = false;
    
    if (!data.invite_code) {
        data.invite_code = Math.random().toString(36).substring(2, 8).toUpperCase();
        needsUpdate = true;
    }
    if (!data.teacher_invite_code) {
        data.teacher_invite_code = 'T-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        needsUpdate = true;
    }
    if (!data.assistant_invite_code) {
        data.assistant_invite_code = 'A-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        needsUpdate = true;
    }
    if (!data.sync_secret) {
        data.sync_secret = generateSyncSecret();
        needsUpdate = true;
    }
    if (!data.calendar_secret) {
        data.calendar_secret = generateSyncSecret();
        needsUpdate = true;
    }
    
    if (needsUpdate) {
        await db.collection('courses').doc(courseId).update({
            invite_code: data.invite_code,
            teacher_invite_code: data.teacher_invite_code,
            assistant_invite_code: data.assistant_invite_code,
            sync_secret: data.sync_secret || null,
            calendar_secret: data.calendar_secret
        });
    }
    
    const result = { id: cSnap.id, ...withoutCredentials(data), course_role: isSysAdmin ? 'admin' : (isAssistant ? 'ayudante' : 'titular') };
    // Los códigos docentes otorgan el rol de titular o ayudante: un ayudante
    // que los viera podría ascenderse a titular (mejora 3.39).
    if (isAssistant) {
        delete result.teacher_invite_code;
        delete result.assistant_invite_code;
    }
    return result;
}

async function updateCourseSettings(payload, context) {
    const { uid, db, admin } = context;
    const courseId = payload.courseId;
    const profileSnap = await db.collection('profiles').doc(uid).get();
    const isSysAdmin = profileSnap.exists && profileSnap.data().role === 'admin';
    if (!isSysAdmin) {
        const accessSnap = await db.collection('course_teachers').doc(`${courseId}_${uid}`).get();
        if (!accessSnap.exists) throw dojoError('NOT_COURSE_MEMBER', "No tienes acceso a este curso");
        if (accessSnap.data().role === 'ayudante') throw dojoError('ASSISTANT_NOT_ALLOWED', "Los ayudantes de cátedra no pueden modificar la planificación base.");
    }
    
    const update = sanitizeCourseSettings(payload.data);
    if (Object.keys(update).length === 0) return { success: true };
    await db.collection('courses').doc(courseId).update(update);

    if (update.class_instances) {
        // Auto-save a version
        const profileSnap = await db.collection('profiles').doc(uid).get();
        const teacherName = profileSnap.exists ? (profileSnap.data().full_name || profileSnap.data().email) : 'Docente';
        await db.collection('schedule_versions').add({
            course_id: courseId,
            version_name: `Autoguardado - ${new Date().toLocaleString('es-AR')}`,
            class_instances: update.class_instances,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            created_by: uid,
            created_by_name: teacherName
        });
    }
    return { success: true };
}

async function cloneCourseExtraData(payload, context) {
    const { db } = context;
    const { courseId, newCourseId } = payload;
    
    const assingmentsSnap = await db.collection('assignments').where('course_id', '==', courseId).get();
    for (let doc of assingmentsSnap.docs) {
        const data = doc.data();
        delete data.created_at;
        
        const assignmentData = {
            ...data,
            course_id: String(newCourseId),
            // Cada tarea clonada necesita su propio secreto de autograding:
            // reutilizarlo permitía publicar notas en ambos cursos.
            sync_secret: generateSyncSecret()
        };
        Object.keys(assignmentData).forEach(k => assignmentData[k] === undefined && delete assignmentData[k]);
        
        await db.collection('assignments').add(assignmentData);
    }
    
    const settingsSnap = await db.collection('courses').doc(courseId).get();
    if (settingsSnap.exists) {
        const data = settingsSnap.data();
        await db.collection('courses').doc(newCourseId).update({
            class_instances: data.class_instances || [],
            schedules: data.schedules || [],
            start_date: data.start_date || '',
            duration_weeks: data.duration_weeks || 16,
            commissions: data.commissions || [],
            commissions_mapping: data.commissions_mapping || {}
        });
    }
    
    return { success: true };
}

async function getStudentCourses(payload, context) {
    const { uid, db } = context;
    const rosterSnap = await db.collection('course_roster').where('student_id', '==', uid).get();
    const enrollSnap = await db.collection('enrollments').where('student_id', '==', uid).get();
    const courseIds = new Set();
    rosterSnap.docs.forEach(d => courseIds.add(d.data().course_id));
    enrollSnap.docs.forEach(d => courseIds.add(d.data().course_id));
    
    const courses = [];
    for (const courseId of courseIds) {
        const cSnap = await db.collection('courses').doc(courseId).get();
        if (cSnap.exists && !isDeleted(cSnap.data())) {
            const data = cSnap.data();
            await ensureCalendarSecret(db, courseId, data);
            courses.push({ id: cSnap.id, ...projectCourseForStudent(data) });
        }
    }
    return courses;
}

async function getCourseRoster(payload, context) {
    const { uid, db, getMyProfile } = context;
    const myProfile = getMyProfile ? await getMyProfile() : null;
    const canSeeFullProfiles = (myProfile && myProfile.role === 'admin')
        || await isCourseStaff(db, payload.courseId, uid);

    const snap = await db.collection('course_roster').where('course_id', '==', payload.courseId).get();
    const students = [];
    for (let doc of snap.docs) {
        const data = doc.data();
        const pSnap = await db.collection('profiles').doc(data.student_id).get();
        if (pSnap.exists) {
            const profile = pSnap.data();
            students.push({
                id: pSnap.id,
                ...(canSeeFullProfiles ? staffStudentProfile(profile) : publicProfile(profile)),
                roster_status: data.status || 'approved',
                enrolled_at: data.enrolled_at
            });
        }
    }
    return students;
}

/**
 * Asigna la comisión de un estudiante en un curso (staffOf(course)). Antes
 * el navegador escribía el perfil directamente y las reglas no podían
 * verificar de qué curso era la comisión.
 */
async function setStudentCommission(payload, context) {
    const { db } = context;
    const { courseId, studentId } = payload;
    if (!courseId || !studentId) throw dojoError('INVALID_ARGUMENT', "Faltan parámetros requeridos");
    const commission = typeof payload.commission === 'string' ? payload.commission.trim() : '';
    if (commission.length > 60) throw dojoError('INVALID_ARGUMENT', "El nombre de la comisión es demasiado largo (máximo 60 caracteres).");

    const enrolled = (await db.collection('course_roster').doc(`${courseId}_${studentId}`).get()).exists
        || (await db.collection('enrollments').doc(`${studentId}_${courseId}`).get()).exists;
    if (!enrolled) throw dojoError('NOT_COURSE_MEMBER', "El estudiante no está inscripto en este curso");

    await db.collection('profiles').doc(studentId).update({ [`commissions.${courseId}`]: commission });
    return { success: true, commission };
}

async function updateRosterStudentStatus(payload, context) {
    const { db } = context;
    const { courseId, studentId, status } = payload; // status: 'approved' | 'pending' | 'observador' | 'removed'
    if (!courseId || !studentId) throw dojoError('INVALID_ARGUMENT', "Faltan parámetros");
    
    if (status === 'removed') {
        await db.collection('course_roster').doc(`${courseId}_${studentId}`).delete();
        await db.collection('enrollments').doc(`${studentId}_${courseId}`).delete();
    } else {
        await db.collection('course_roster').doc(`${courseId}_${studentId}`).set({
            course_id: courseId,
            student_id: studentId,
            status: status
        }, { merge: true });
        await db.collection('enrollments').doc(`${studentId}_${courseId}`).set({
            course_id: courseId,
            student_id: studentId,
            status: status
        }, { merge: true });
    }
    return { success: true };
}

async function syncGuaraniRoster(payload, context) {
    const { db, admin } = context;
    const { courseId, rows } = payload; // rows: array of { legajo, alumno, document, status, email }
    if (!courseId || !Array.isArray(rows)) throw dojoError('INVALID_ARGUMENT', "Datos de sincronización inválidos");

    const checksum = rosterChecksum(rows, ['legajo', 'email', 'status']);
    if (!(await shouldSyncRoster(db, courseId, 'guarani', checksum, payload.force === true))) {
        return { success: true, unchanged: true, count: rows.length };
    }

    // Fetch existing roster
    const existingSnap = await db.collection('course_roster').where('course_id', '==', courseId).get();
    const existingMap = new Map(); // studentId -> doc
    existingSnap.docs.forEach(doc => {
        existingMap.set(doc.data().student_id, doc.data());
    });

    const newStudentIds = new Set();

    for (const r of rows) {
        const cleanEmail = (r.email || '').trim().toLowerCase();
        const cleanLegajo = (r.legajo || '').trim();

        if (!cleanEmail && !cleanLegajo) continue;

        // Try to match existing profile by email or secondary_emails or legajo
        let matchedUid = null;
        if (cleanEmail) {
            const pByEmail = await db.collection('profiles').where('email', '==', cleanEmail).get();
            if (!pByEmail.empty) {
                matchedUid = pByEmail.docs[0].id;
            } else {
                const pBySec = await db.collection('profiles').where('secondary_emails', 'array-contains', cleanEmail).get();
                if (!pBySec.empty) matchedUid = pBySec.docs[0].id;
            }
        }

        if (!matchedUid && cleanLegajo) {
            const pByLeg = await db.collection('profiles').where('matricula_unrn', '==', cleanLegajo).get();
            if (!pByLeg.empty) matchedUid = pByLeg.docs[0].id;
        }

        // If profile doesn't exist, create a placeholder profile doc so student can link later
        if (!matchedUid) {
            const newRef = db.collection('profiles').doc();
            matchedUid = newRef.id;
            await newRef.set({
                id: matchedUid,
                full_name: r.alumno || cleanEmail.split('@')[0] || 'Estudiante SIU',
                email: cleanEmail,
                matricula_unrn: cleanLegajo || '',
                role: 'student',
                account_status: 'approved',
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });
        } else {
            // Update matricula if present
            if (cleanLegajo) {
                await db.collection('profiles').doc(matchedUid).update({ matricula_unrn: cleanLegajo });
            }
        }

        newStudentIds.add(matchedUid);

        // Add or approve student in roster
        await db.collection('course_roster').doc(`${courseId}_${matchedUid}`).set({
            course_id: courseId,
            student_id: matchedUid,
            status: 'approved',
            guarani_synced_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        await db.collection('enrollments').doc(`${matchedUid}_${courseId}`).set({
            course_id: courseId,
            student_id: matchedUid,
            status: 'approved'
        }, { merge: true });
    }

    // Students previously enrolled but NOT in the new SIU Guarani list -> set role to 'observador' (requirement 15)
    for (const [prevSid, prevData] of existingMap.entries()) {
        if (!newStudentIds.has(prevSid)) {
            await db.collection('course_roster').doc(`${courseId}_${prevSid}`).update({
                status: 'observador'
            });
            await db.collection('enrollments').doc(`${prevSid}_${courseId}`).update({
                status: 'observador'
            });
        }
    }

    await saveRosterChecksum(db, courseId, 'guarani', checksum, rows.length);
    return { success: true, count: rows.length };
}

module.exports = {
    getCourseDetails,
    enrollCourse,
    createCourse,
    deleteCourse,
    restoreCourse,
    updateCourseName,
    getCourseTeachers,
    assignTeacher,
    removeTeacher,
    getTeacherCourses,
    getCourseSettings,
    updateCourseSettings,
    cloneCourseExtraData,
    getStudentCourses,
    getCourseRoster,
    updateRosterStudentStatus,
    setStudentCommission,
    sanitizeCourseSettings,
    withoutCredentials,
    syncGuaraniRoster,
    projectCourse,
    projectCourseForStudent
};
