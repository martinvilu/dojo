async function createStudyGroup(payload, context) {
    const { uid, db, admin } = context;
    const { courseId, name, description, schedulePrefs } = payload;
    const profileSnap = await db.collection('profiles').doc(uid).get();
    if (!profileSnap.exists) throw new Error("Perfil no encontrado");
    
    const groupRef = await db.collection('study_groups').add({
        course_id: courseId,
        name: name,
        description: description,
        schedule_prefs: schedulePrefs,
        members: [uid],
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        created_by: uid
    });
    return { success: true, id: groupRef.id };
}

async function joinStudyGroup(payload, context) {
    const { uid, db, admin } = context;
    const { groupId } = payload;
    const groupRef = db.collection('study_groups').doc(groupId);
    const doc = await groupRef.get();
    if (!doc.exists) throw new Error("Grupo no encontrado");
    
    const members = doc.data().members || [];
    if (members.includes(uid)) return { success: true };
    
    await groupRef.update({
        members: admin.firestore.FieldValue.arrayUnion(uid)
    });
    return { success: true };
}

async function leaveStudyGroup(payload, context) {
    const { uid, db } = context;
    const { groupId } = payload;
    const groupRef = db.collection('study_groups').doc(groupId);
    const doc = await groupRef.get();
    if (!doc.exists) throw new Error("Grupo no encontrado");
    
    const members = doc.data().members || [];
    const newMembers = members.filter(m => m !== uid);
    
    if (newMembers.length === 0) {
        await groupRef.delete();
    } else {
        await groupRef.update({
            members: newMembers
        });
    }
    return { success: true };
}

async function getStudyGroups(payload, context) {
    const { db } = context;
    const courseId = payload.courseId;
    const snap = await db.collection('study_groups').where('course_id', '==', courseId).get();
    
    const groups = [];
    for (let doc of snap.docs) {
        const data = doc.data();
        const memberProfiles = [];
        for (let memberId of data.members || []) {
            const pSnap = await db.collection('profiles').doc(memberId).get();
            if (pSnap.exists) memberProfiles.push({ id: memberId, ...pSnap.data() });
        }
        groups.push({
            id: doc.id,
            ...data,
            member_profiles: memberProfiles,
            created_at: data.created_at ? data.created_at.toDate().toISOString() : null
        });
    }
    return groups;
}

async function findStudyBuddies(payload, context) {
    const { uid, db } = context;
    const { courseId, schedulePrefs } = payload;
    const rosterSnap = await db.collection('course_roster').where('course_id', '==', courseId).get();
    const studentIds = rosterSnap.docs.map(d => d.data().student_id);
    
    const matchedStudents = [];
    for (let studentId of studentIds) {
        if (studentId === uid) continue;
        
        const pSnap = await db.collection('profiles').doc(studentId).get();
        if (pSnap.exists) {
            const pData = pSnap.data();
            const matchesPrefs = pData.schedule_pref === schedulePrefs;
            if (matchesPrefs) {
                matchedStudents.push({
                    id: studentId,
                    full_name: pData.full_name,
                    email: pData.email,
                    role: pData.role,
                    schedule_pref: pData.schedule_pref
                });
            }
        }
    }
    return matchedStudents;
}

module.exports = {
    createStudyGroup,
    joinStudyGroup,
    leaveStudyGroup,
    getStudyGroups,
    findStudyBuddies
};
