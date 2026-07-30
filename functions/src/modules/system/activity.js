async function logActivity(payload, context) {
    const { uid, db, admin } = context;
    const { action, details } = payload;
    const pSnap = await db.collection('profiles').doc(uid).get();
    const profile = pSnap.exists ? pSnap.data() : {};

    await db.collection('activity_logs').add({
        uid,
        user_name: profile.full_name || profile.email || 'Usuario',
        user_email: profile.email || '',
        user_role: profile.role || 'student',
        action: action || 'desconocida',
        details: details || '',
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
}

async function getActivityLogs(payload, context) {
    const { db, getMyProfile } = context;
    const myProfile = await getMyProfile();
    if (myProfile.role !== 'admin') throw new Error("Solo los administradores pueden ver los registros de actividad.");

    const snap = await db.collection('activity_logs').orderBy('timestamp', 'desc').limit(100).get();
    return snap.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            timestamp: data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate().toISOString() : new Date(data.timestamp).toISOString()) : new Date().toISOString()
        };
    });
}

module.exports = {
    logActivity,
    getActivityLogs
};
