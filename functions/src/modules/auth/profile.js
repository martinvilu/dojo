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
    const allowed = {};
    if (payload.full_name !== undefined) allowed.full_name = payload.full_name;
    if (payload.github_username !== undefined) allowed.github_username = payload.github_username;
    if (payload.github_user !== undefined) allowed.github_user = payload.github_user;
    if (payload.matricula_unrn !== undefined) allowed.matricula_unrn = payload.matricula_unrn;
    if (payload.cohort !== undefined) allowed.cohort = payload.cohort;

    await db.collection('profiles').doc(uid).update(allowed);
    return { success: true };
}

async function addSecondaryEmail(payload, context) {
    const { uid, db } = context;
    const email = (payload.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) throw new Error("Email secundario inválido");

    const pRef = db.collection('profiles').doc(uid);
    const pSnap = await pRef.get();
    if (!pSnap.exists) throw new Error("Perfil no encontrado");

    const currentSec = pSnap.data().secondary_emails || [];
    if (!currentSec.includes(email)) {
        currentSec.push(email);
        await pRef.update({ secondary_emails: currentSec });
    }
    return { success: true, secondary_emails: currentSec };
}

async function mergeProfiles(payload, context) {
    const { db, getMyProfile } = context;
    const myProfile = await getMyProfile();
    if (myProfile.role !== 'admin') throw new Error("Solo los administradores pueden fusionar perfiles");

    const { targetUid, sourceUid } = payload; // merge sourceUid into targetUid
    if (!targetUid || !sourceUid || targetUid === sourceUid) throw new Error("Parámetros de fusión inválidos");

    const targetRef = db.collection('profiles').doc(targetUid);
    const sourceRef = db.collection('profiles').doc(sourceUid);

    const tSnap = await targetRef.get();
    const sSnap = await sourceRef.get();

    if (!tSnap.exists || !sSnap.exists) throw new Error("Uno o ambos perfiles no existen");

    const sData = sSnap.data();
    const tData = tSnap.data();

    // Add source email to target's secondary emails
    const secEmails = new Set(tData.secondary_emails || []);
    if (sData.email) secEmails.add(sData.email.toLowerCase());
    if (Array.isArray(sData.secondary_emails)) {
        sData.secondary_emails.forEach(e => secEmails.add(e.toLowerCase()));
    }

    await targetRef.update({
        secondary_emails: Array.from(secEmails),
        matricula_unrn: tData.matricula_unrn || sData.matricula_unrn || '',
        github_user: tData.github_user || sData.github_user || '',
        github_username: tData.github_username || sData.github_username || ''
    });

    // Transfer course_roster
    const rSnap = await db.collection('course_roster').where('student_id', '==', sourceUid).get();
    for (let doc of rSnap.docs) {
        const d = doc.data();
        await db.collection('course_roster').doc(`${d.course_id}_${targetUid}`).set({
            ...d,
            student_id: targetUid
        }, { merge: true });
        await doc.ref.delete();
    }

    // Delete source profile doc
    await sourceRef.delete();

    return { success: true, message: `Perfil ${sourceUid} fusionado exitosamente con ${targetUid}` };
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

async function getXpLogs(payload, context) {
    const { uid, db } = context;
    const snap = await db.collection('profiles').doc(uid).collection('xp_logs').orderBy('timestamp', 'desc').get();
    return snap.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            action: data.action,
            description: data.description,
            points: data.points,
            timestamp: data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate().toISOString() : new Date(data.timestamp).toISOString()) : new Date().toISOString()
        };
    });
}

module.exports = {
    getProfile,
    updateProfile,
    addSecondaryEmail,
    mergeProfiles,
    submitMatricula,
    getXpLogs
};
