async function getCourseDetails(payload, context) {
    const { uid, db, getMyProfile } = context;
    const courseId = payload.courseId;
    const rosterSnap = await db.collection('course_roster').doc(`${courseId}_${uid}`).get();
    const teacherSnap = await db.collection('course_teachers').doc(`${courseId}_${uid}`).get();
    const enrollSnap = await db.collection('enrollments').where('course_id', '==', courseId).where('student_id', '==', uid).get();
    const myProfile = await getMyProfile();
    
    if (!rosterSnap.exists && !teacherSnap.exists && enrollSnap.empty && myProfile.role !== 'admin') {
        throw new Error("No tienes acceso a este curso");
    }
    
    const cSnap = await db.collection('courses').doc(courseId).get();
    if (!cSnap.exists) throw new Error("Curso no encontrado");
    
    const data = cSnap.data();
    if (!data.sync_secret) {
        data.sync_secret = Math.random().toString(36).substring(2, 10).toUpperCase();
        await db.collection('courses').doc(courseId).update({
            sync_secret: data.sync_secret
        });
    }
    
    return { id: cSnap.id, ...data };
}

async function enrollCourse(payload, context) {
    const { uid, db, admin } = context;
    const code = payload.code.trim();
    const snap = await db.collection('courses').where('invite_code', '==', code).get();
    if (!snap.empty) {
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
    if (!tSnap.empty) {
        const courseId = tSnap.docs[0].id;
        await db.collection('course_teachers').doc(`${courseId}_${uid}`).set({
            course_id: courseId,
            teacher_id: uid,
            role: 'titular'
        });
        await db.collection('profiles').doc(uid).update({ role: 'teacher', account_status: 'approved' });
        return { success: true };
    }
    
    const aSnap = await db.collection('courses').where('assistant_invite_code', '==', code).get();
    if (!aSnap.empty) {
        const courseId = aSnap.docs[0].id;
        await db.collection('course_teachers').doc(`${courseId}_${uid}`).set({
            course_id: courseId,
            teacher_id: uid,
            role: 'ayudante'
        });
        await db.collection('profiles').doc(uid).update({ role: 'teacher', account_status: 'approved' });
        return { success: true };
    }
    
    throw new Error("Código de invitación inválido");
}

async function createCourse(payload, context) {
    const { uid, db, admin } = context;
    const ref = await db.collection('courses').add({
        name: payload.name,
        github_org: payload.github_org,
        invite_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
        teacher_invite_code: 'T-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
        assistant_invite_code: 'A-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
        sync_secret: Math.random().toString(36).substring(2, 10).toUpperCase(),
        created_by: uid,
        created_at: admin.firestore.FieldValue.serverTimestamp()
    });
    return { id: ref.id };
}

async function deleteCourse(payload, context) {
    const { db } = context;
    const { courseId } = payload;
    if (!courseId) throw new Error("ID de cátedra requerido");
    await db.collection('courses').doc(courseId).delete();
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
        teachers.push({ ...t, profiles: p.data() });
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

async function getTeacherCourses(payload, context) {
    const { uid, db } = context;
    const snap = await db.collection('course_teachers').where('teacher_id', '==', uid).get();
    const courses = [];
    for (let doc of snap.docs) {
        const cSnap = await db.collection('courses').doc(doc.data().course_id).get();
        if (cSnap.exists) {
            courses.push({ id: cSnap.id, course_role: doc.data().role || 'titular', ...cSnap.data() });
        }
    }
    return courses;
}

async function getCourseSettings(payload, context) {
    const { uid, db } = context;
    const courseId = payload.courseId;
    const profileSnap = await db.collection('profiles').doc(uid).get();
    const isSysAdmin = profileSnap.exists && profileSnap.data().role === 'admin';
    if (!isSysAdmin) {
        const accessSnap = await db.collection('course_teachers').doc(`${courseId}_${uid}`).get();
        if (!accessSnap.exists) throw new Error("No tienes acceso a este curso");
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
        data.sync_secret = Math.random().toString(36).substring(2, 10).toUpperCase();
        needsUpdate = true;
    }
    
    if (needsUpdate) {
        await db.collection('courses').doc(courseId).update({
            invite_code: data.invite_code,
            teacher_invite_code: data.teacher_invite_code,
            assistant_invite_code: data.assistant_invite_code,
            sync_secret: data.sync_secret || null
        });
    }
    
    return { id: cSnap.id, ...data };
}

async function updateCourseSettings(payload, context) {
    const { uid, db, admin } = context;
    const courseId = payload.courseId;
    const profileSnap = await db.collection('profiles').doc(uid).get();
    const isSysAdmin = profileSnap.exists && profileSnap.data().role === 'admin';
    if (!isSysAdmin) {
        const accessSnap = await db.collection('course_teachers').doc(`${courseId}_${uid}`).get();
        if (!accessSnap.exists) throw new Error("No tienes acceso a este curso");
        if (accessSnap.data().role === 'ayudante') throw new Error("Los ayudantes de cátedra no pueden modificar la planificación base.");
    }
    
    await db.collection('courses').doc(courseId).update(payload.data);

    if (payload.data.class_instances) {
        // Auto-save a version
        const profileSnap = await db.collection('profiles').doc(uid).get();
        const teacherName = profileSnap.exists ? (profileSnap.data().full_name || profileSnap.data().email) : 'Docente';
        await db.collection('schedule_versions').add({
            course_id: courseId,
            version_name: `Autoguardado - ${new Date().toLocaleString('es-AR')}`,
            class_instances: payload.data.class_instances,
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
        await db.collection('assignments').add({
            ...data,
            course_id: newCourseId
        });
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
        if (cSnap.exists) courses.push({ id: cSnap.id, ...cSnap.data() });
    }
    return courses;
}

async function getCourseRoster(payload, context) {
    const { db } = context;
    const snap = await db.collection('course_roster').where('course_id', '==', payload.courseId).get();
    const students = [];
    for (let doc of snap.docs) {
        const data = doc.data();
        const pSnap = await db.collection('profiles').doc(data.student_id).get();
        if (pSnap.exists) {
            students.push({
                id: pSnap.id,
                ...pSnap.data(),
                roster_status: data.status || 'approved',
                enrolled_at: data.enrolled_at
            });
        }
    }
    return students;
}

async function updateRosterStudentStatus(payload, context) {
    const { db } = context;
    const { courseId, studentId, status } = payload; // status: 'approved' | 'pending' | 'observador' | 'removed'
    if (!courseId || !studentId) throw new Error("Faltan parámetros");
    
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
    if (!courseId || !Array.isArray(rows)) throw new Error("Datos de sincronización inválidos");

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

    return { success: true, count: rows.length };
}

module.exports = {
    getCourseDetails,
    enrollCourse,
    createCourse,
    deleteCourse,
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
    syncGuaraniRoster
};

