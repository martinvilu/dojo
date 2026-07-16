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
        await db.collection('course_roster').doc(`${courseId}_${uid}`).set({
            course_id: courseId,
            student_id: uid,
            enrolled_at: admin.firestore.FieldValue.serverTimestamp()
        });
        return { success: true };
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
    const accessSnap = await db.collection('course_teachers').doc(`${courseId}_${uid}`).get();
    if (!accessSnap.exists) throw new Error("No tienes acceso a este curso");
    
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
    const accessSnap = await db.collection('course_teachers').doc(`${courseId}_${uid}`).get();
    if (!accessSnap.exists) throw new Error("No tienes acceso a este curso");
    if (accessSnap.data().role === 'ayudante') throw new Error("Los ayudantes de cátedra no pueden modificar la planificación base.");
    
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
        const pSnap = await db.collection('profiles').doc(doc.data().student_id).get();
        if (pSnap.exists) students.push({ id: pSnap.id, ...pSnap.data() });
    }
    return students;
}

module.exports = {
    getCourseDetails,
    enrollCourse,
    createCourse,
    updateCourseName,
    getCourseTeachers,
    assignTeacher,
    removeTeacher,
    getTeacherCourses,
    getCourseSettings,
    updateCourseSettings,
    cloneCourseExtraData,
    getStudentCourses,
    getCourseRoster
};
