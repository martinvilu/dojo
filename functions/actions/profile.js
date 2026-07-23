const admin = require("firebase-admin");

async function getProfile(payload, context) {
    const { uid, db, authUser } = context;
    const ref = db.collection('profiles').doc(uid);
    let pSnap = await ref.get();
    
    if (!pSnap.exists) {
        let role = 'student';
        const email = authUser?.email || payload?.email || '';
        if (email === 'admin@jutsu.com' || email === 'admin@gaula.com' || email === 'admin@dojo.com') role = 'admin';
        if (email === 'teacher@jutsu.com' || email === 'teacher@gaula.com' || email === 'teacher@dojo.com') role = 'teacher';

        const profileData = {
            id: uid,
            full_name: authUser?.name || (email ? email.split('@')[0] : 'User'),
            email: email,
            role: role,
            avatar_url: authUser?.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(authUser?.name || 'User')}`,
            account_status: role === 'student' ? 'pending' : 'approved',
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            last_login: admin.firestore.FieldValue.serverTimestamp()
        };
        await ref.set(profileData, { merge: true });
        pSnap = await ref.get();
      if (!pSnap.exists) return profileData;
    } else {
        await ref.update({
            last_login: admin.firestore.FieldValue.serverTimestamp()
        });
    }
    
    const data = pSnap.data();
    data.last_login = admin.firestore.Timestamp.now();
    return data;
}

async function updateProfile(payload, context) {
    const { uid, db } = context;
    await db.collection('profiles').doc(uid).update(payload);
    return { success: true };
}

async function submitMatricula(payload, context) {
    const { uid, db } = context;
    const { matricula } = payload;
    if (!matricula || !/^UNRN-\d{5,}$/.test(matricula)) {
        throw new Error("Formato de matrícula inválido. Debe ser UNRN- seguido de al menos 5 dígitos.");
    }
    await db.collection('profiles').doc(uid).update({
        matricula_unrn: matricula,
        account_status: 'approved'
    });
    return { success: true };
}

module.exports = {
    getProfile,
    updateProfile,
    submitMatricula
};
