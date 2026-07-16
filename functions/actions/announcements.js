async function createAnnouncement(payload, context) {
    const { uid, db, admin } = context;
    await db.collection('announcements').add({
        course_id: payload.course_id,
        message: payload.message,
        teacher_id: uid,
        created_at: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
}

async function getTeacherAnnouncements(payload, context) {
    const { uid, db } = context;
    const snap = await db.collection('announcements').where('teacher_id', '==', uid).orderBy('created_at', 'desc').limit(20).get();
    const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return arr;
}

async function getStudentAnnouncements(payload, context) {
    const { uid, db } = context;
    const courseIds = payload.courseIds || [];
    if (courseIds.length === 0) return [];
    
    const arr = [];
    const chunks = [];
    for (let i = 0; i < courseIds.length; i += 10) {
        chunks.push(courseIds.slice(i, i + 10));
    }
    
    for (const chunk of chunks) {
        const snap = await db.collection('announcements').where('course_id', 'in', chunk).orderBy('created_at', 'desc').limit(10).get();
        for (let doc of snap.docs) {
            const data = doc.data();
            const ackRef = db.collection('announcement_acknowledgments').doc(`${doc.id}_${uid}`);
            const ackDoc = await ackRef.get();
            arr.push({
                id: doc.id,
                ...data,
                acknowledged: ackDoc.exists
            });
        }
    }
    // Sort by created_at descending
    arr.sort((a, b) => {
        const da = a.created_at ? a.created_at.toMillis() : 0;
        const db2 = b.created_at ? b.created_at.toMillis() : 0;
        return db2 - da;
    });
    return arr;
}

async function acknowledgeAnnouncement(payload, context) {
    const { uid, db, admin } = context;
    const { announcementId } = payload;
    await db.collection('announcement_acknowledgments').doc(`${announcementId}_${uid}`).set({
        announcement_id: announcementId,
        student_id: uid,
        acknowledged_at: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
}

async function getAnnouncementAcknowledgements(payload, context) {
    const { db } = context;
    const { announcementId } = payload;
    const snap = await db.collection('announcement_acknowledgments').where('announcement_id', '==', announcementId).get();
    const acknowledgments = [];
    for (let doc of snap.docs) {
        const data = doc.data();
        const pSnap = await db.collection('profiles').doc(data.student_id).get();
        acknowledgments.push({
            student_id: data.student_id,
            acknowledged_at: data.acknowledged_at,
            profile: pSnap.data()
        });
    }
    return acknowledgments;
}

module.exports = {
    createAnnouncement,
    getTeacherAnnouncements,
    getStudentAnnouncements,
    acknowledgeAnnouncement,
    getAnnouncementAcknowledgements
};
