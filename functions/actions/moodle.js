async function moodleAutoEnroll(payload, context) {
    const { uid, db, admin } = context;
    const { courseId } = payload;
    if (!courseId) throw new Error("Falta el ID del curso");
    
    const pSnap = await db.collection('profiles').doc(uid).get();
    const profile = pSnap.exists ? pSnap.data() : {};
    
    if (profile.role === 'teacher') {
        const rosterRef = db.collection('course_teachers').doc(`${courseId}_${uid}`);
        const rSnap = await rosterRef.get();
        if (!rSnap.exists) {
            await rosterRef.set({
                course_id: courseId,
                teacher_id: uid,
                role: 'auxiliar'
            });
        }
    } else {
        const rosterRef = db.collection('course_roster').doc(`${courseId}_${uid}`);
        const rSnap = await rosterRef.get();
        if (!rSnap.exists) {
            await rosterRef.set({
                course_id: courseId,
                student_id: uid,
                enrolled_at: admin.firestore.FieldValue.serverTimestamp()
            });
        }
    }
    
    await db.collection('audit_logs').add({
        action: 'moodle_auto_enroll',
        course_id: courseId,
        student_id: uid,
        actor_id: uid,
        actor_name: profile.full_name || profile.email || uid,
        created_at: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return { success: true };
}

module.exports = {
    moodleAutoEnroll
};
