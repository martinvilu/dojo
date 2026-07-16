const admin = require("firebase-admin");

async function getProfile(payload, context) {
    const { uid, db } = context;
    const ref = db.collection('profiles').doc(uid);
    const pSnap = await ref.get();
    if (!pSnap.exists) return null;
    
    await ref.update({
        last_login: admin.firestore.FieldValue.serverTimestamp()
    });
    
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
