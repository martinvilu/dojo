async function createSystemBackup(payload, context) {
    const { uid, db, admin, getMyProfile } = context;
    const profile = await getMyProfile();
    if (profile.role !== 'admin') throw new Error("Acceso denegado");
    
    const coursesSnap = await db.collection('courses').get();
    const coursesBackup = coursesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    const assignmentsSnap = await db.collection('assignments').get();
    const assignmentsBackup = assignmentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    const profilesSnap = await db.collection('profiles').get();
    const profilesBackup = profilesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    const backupRef = await db.collection('backups').add({
        courses: coursesBackup,
        assignments: assignmentsBackup,
        profiles: profilesBackup,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        created_by: uid,
        created_by_name: profile.full_name || profile.email
    });
    return { success: true, backupId: backupRef.id };
}

async function getSystemBackups(payload, context) {
    const { db, getMyProfile } = context;
    const profile = await getMyProfile();
    if (profile.role !== 'admin') throw new Error("Acceso denegado");
    
    const snap = await db.collection('backups').orderBy('created_at', 'desc').get();
    return snap.docs.map(d => {
        const data = d.data();
        return {
            id: d.id,
            created_at: data.created_at ? data.created_at.toDate().toISOString() : null,
            created_by_name: data.created_by_name,
            courses_count: (data.courses || []).length,
            assignments_count: (data.assignments || []).length,
            profiles_count: (data.profiles || []).length
        };
    });
}

async function restoreBackupDocument(payload, context) {
    const { db, getMyProfile } = context;
    const profile = await getMyProfile();
    if (profile.role !== 'admin') throw new Error("Acceso denegado");
    
    const { backupId, collectionName, docId } = payload;
    const backupSnap = await db.collection('backups').doc(backupId).get();
    if (!backupSnap.exists) throw new Error("Respaldo no encontrado");
    const backupData = backupSnap.data();
    
    const collectionData = backupData[collectionName];
    if (!collectionData) throw new Error(`Colección ${collectionName} no disponible en el respaldo`);
    
    const docData = collectionData.find(d => d.id === docId);
    if (!docData) throw new Error(`Documento con ID ${docId} no encontrado en este respaldo`);
    
    const { id, ...dataToRestore } = docData;
    await db.collection(collectionName).doc(docId).set(dataToRestore);
    
    return { success: true };
}

module.exports = {
    createSystemBackup,
    getSystemBackups,
    restoreBackupDocument
};
