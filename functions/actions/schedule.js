async function saveScheduleVersion(payload, context) {
    const { uid, db, admin } = context;
    const { courseId, versionName, classInstances } = payload;
    const accessSnap = await db.collection('course_teachers').doc(`${courseId}_${uid}`).get();
    if (!accessSnap.exists) throw new Error("No tienes acceso a este curso");
    if (accessSnap.data().role === 'ayudante') throw new Error("Los ayudantes de cátedra no pueden modificar la planificación base.");
    
    const profileSnap = await db.collection('profiles').doc(uid).get();
    const teacherName = profileSnap.exists ? (profileSnap.data().full_name || profileSnap.data().email) : 'Docente';
    
    await db.collection('schedule_versions').add({
        course_id: courseId,
        version_name: versionName,
        class_instances: classInstances,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        created_by: uid,
        created_by_name: teacherName
    });
    return { success: true };
}

async function getScheduleVersions(payload, context) {
    const { uid, db } = context;
    const courseId = payload.courseId;
    const accessSnap = await db.collection('course_teachers').doc(`${courseId}_${uid}`).get();
    if (!accessSnap.exists) throw new Error("No tienes acceso a este curso");
    
    const snap = await db.collection('schedule_versions')
        .where('course_id', '==', courseId)
        .orderBy('created_at', 'desc')
        .get();
        
    return snap.docs.map(d => {
        const data = d.data();
        return {
            id: d.id,
            ...data,
            created_at: data.created_at ? data.created_at.toDate().toISOString() : null
        };
    });
}

async function restoreScheduleVersion(payload, context) {
    const { uid, db } = context;
    const { courseId, versionId } = payload;
    const accessSnap = await db.collection('course_teachers').doc(`${courseId}_${uid}`).get();
    if (!accessSnap.exists) throw new Error("No tienes acceso a este curso");
    if (accessSnap.data().role === 'ayudante') throw new Error("Los ayudantes de cátedra no pueden modificar la planificación base.");
    
    const verSnap = await db.collection('schedule_versions').doc(versionId).get();
    if (!verSnap.exists) throw new Error("Versión de cronograma no encontrada");
    
    const classInstances = verSnap.data().class_instances;
    await db.collection('courses').doc(courseId).update({
        class_instances: classInstances
    });
    return { success: true, class_instances: classInstances };
}

async function getComparisonCourses(payload, context) {
    const { db } = context;
    const snap = await db.collection('courses').get();
    return snap.docs.map(d => {
        const data = d.data();
        return {
            id: d.id,
            name: data.name,
            class_instances: data.class_instances || []
        };
    });
}

module.exports = {
    saveScheduleVersion,
    getScheduleVersions,
    restoreScheduleVersion,
    getComparisonCourses
};
