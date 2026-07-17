async function approveUser(payload, context) {
    const { db, getMyProfile } = context;
    const { targetUid } = payload;
    const myProfile = await getMyProfile();
    if (myProfile.role !== 'admin') throw new Error("Solo admins pueden aprobar usuarios");
    
    await db.collection('profiles').doc(targetUid).update({
        account_status: 'approved'
    });
    return { success: true };
}

async function updateUserRole(payload, context) {
    const { db, getMyProfile } = context;
    const { targetUid, newRole } = payload;
    const myProfile = await getMyProfile();
    if (myProfile.role !== 'admin') throw new Error("Solo admins pueden cambiar roles de usuario");
    if (!['admin', 'teacher', 'student'].includes(newRole)) throw new Error("Rol inválido");
    
    await db.collection('profiles').doc(targetUid).update({
        role: newRole
    });
    return { success: true };
}

async function updateUserProfile(payload, context) {
    const { db } = context;
    await db.collection('profiles').doc(payload.userId).update(payload.data);
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
        const c = { id: doc.id, ...doc.data() };
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

async function saveGlobalSettings(payload, context) {
    const { db, getMyProfile } = context;
    const myProfile = await getMyProfile();
    if (myProfile.role !== 'admin') throw new Error('Only admin can save global settings');
    await db.collection('globals').doc('settings').set(payload, { merge: true });
    return { success: true };
}

async function getAdminCourseDetails(payload, context) {
    const { db } = context;
    const courseId = payload.courseId;
    const cSnap = await db.collection('courses').doc(courseId).get();
    if (!cSnap.exists) throw new Error("Course not found");
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
    if (myProfile.role !== 'admin') throw new Error("Solo los administradores pueden borrar usuarios");

    // 1. Delete from Firebase Auth
    try {
        await admin.auth().deleteUser(targetUid);
    } catch (authErr) {
        console.warn("User did not exist in Firebase Auth or failed to delete:", authErr.message);
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

module.exports = {
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
