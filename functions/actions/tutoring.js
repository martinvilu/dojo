async function registerAsTutor(payload, context) {
    const { uid, db, admin } = context;
    const { courseId, topics, availability } = payload;
    const profileSnap = await db.collection('profiles').doc(uid).get();
    if (!profileSnap.exists) throw new Error("Perfil no encontrado");
    const pData = profileSnap.data();
    
    await db.collection('tutors').doc(`${courseId}_${uid}`).set({
        course_id: courseId,
        user_id: uid,
        user_name: pData.full_name || pData.email,
        email: pData.email,
        topics: topics,
        availability: availability,
        registered_at: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
}

async function getCourseTutors(payload, context) {
    const { db } = context;
    const courseId = payload.courseId;
    const snap = await db.collection('tutors').where('course_id', '==', courseId).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function bookTutoringSession(payload, context) {
    const { uid, db, admin } = context;
    const { courseId, tutorId, dateTime, topic } = payload;
    const profileSnap = await db.collection('profiles').doc(uid).get();
    if (!profileSnap.exists) throw new Error("Perfil no encontrado");
    const pData = profileSnap.data();
    
    const tutorProf = await db.collection('profiles').doc(tutorId).get();
    const tutorName = tutorProf.exists ? (tutorProf.data().full_name || tutorProf.data().email) : 'Tutor';
    
    const meetingId = Math.random().toString(36).substring(2, 5) + '-' + 
                      Math.random().toString(36).substring(2, 6) + '-' + 
                      Math.random().toString(36).substring(2, 5);
    
    const ref = await db.collection('tutoring_sessions').add({
        course_id: courseId,
        tutor_id: tutorId,
        tutor_name: tutorName,
        student_id: uid,
        student_name: pData.full_name || pData.email,
        date_time: dateTime,
        topic: topic,
        status: 'requested',
        meeting_link: `https://meet.google.com/${meetingId}`,
        created_at: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true, id: ref.id };
}

async function getTutoringSessions(payload, context) {
    const { uid, db } = context;
    const { courseId, role } = payload;
    let queryRef = db.collection('tutoring_sessions').where('course_id', '==', courseId);
    if (role === 'tutor') {
        queryRef = queryRef.where('tutor_id', '==', uid);
    } else {
        queryRef = queryRef.where('student_id', '==', uid);
    }
    const snap = await queryRef.get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function updateTutoringSessionStatus(payload, context) {
    const { uid, db } = context;
    const { sessionId, status } = payload;
    const ref = db.collection('tutoring_sessions').doc(sessionId);
    const doc = await ref.get();
    if (!doc.exists) throw new Error("Sesión no encontrada");
    
    const data = doc.data();
    if (data.tutor_id !== uid && data.student_id !== uid) {
        throw new Error("No tienes permiso para modificar esta sesión");
    }
    
    await ref.update({ status });
    return { success: true };
}

module.exports = {
    registerAsTutor,
    getCourseTutors,
    bookTutoringSession,
    getTutoringSessions,
    updateTutoringSessionStatus
};
