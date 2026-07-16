async function notifyCourseStudents(payload, context) {
    const { uid, db, admin } = context;
    const { courseId, message, link } = payload;
    
    // Check teacher auth
    const accessSnap = await db.collection('course_teachers').doc(`${courseId}_${uid}`).get();
    if (!accessSnap.exists) throw new Error("No tienes acceso a este curso");
    
    const studentsSnap = await db.collection('course_roster').where('course_id', '==', courseId).get();
    
    const chunks = [];
    let currentBatch = db.batch();
    let count = 0;
    
    for (let doc of studentsSnap.docs) {
        const sData = doc.data();
        const studentId = sData.student_id;
        
        let is_daily_pending = false;
        const pSnap = await db.collection('profiles').doc(studentId).get();
        if (pSnap.exists && pSnap.data().notification_pref === 'daily_summary') {
            is_daily_pending = true;
        }
        
        const ref = db.collection('notifications').doc();
        currentBatch.set(ref, {
            student_id: studentId,
            message,
            link: link || null,
            read: false,
            is_daily_pending,
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });
        count++;
        if (count === 490) {
            chunks.push(currentBatch.commit());
            currentBatch = db.batch();
            count = 0;
        }
    }
    if (count > 0) chunks.push(currentBatch.commit());
    await Promise.all(chunks);
    return { success: true };
}

async function checkAndAlertStudentsAtRisk(payload, context) {
    const { uid, db, admin } = context;
    const { courseId } = payload;
    const accessSnap = await db.collection('course_teachers').doc(`${courseId}_${uid}`).get();
    if (!accessSnap.exists) throw new Error("No tienes acceso a este curso");
    
    const courseSnap = await db.collection('courses').doc(courseId).get();
    if (!courseSnap.exists) throw new Error("Curso no encontrado");
    const courseName = courseSnap.data().name;
    const classes = courseSnap.data().class_instances || [];
    
    const rosterSnap = await db.collection('course_roster').where('course_id', '==', courseId).get();
    const assignmentsSnap = await db.collection('assignments').where('course_id', '==', courseId).get();
    const totalAssignments = assignmentsSnap.size;
    
    const alertsTriggered = [];
    
    for (let studentDoc of rosterSnap.docs) {
        const sData = studentDoc.data();
        const studentId = sData.student_id;
        
        const attSnap = await db.collection('attendance').where('course_id', '==', courseId).where('student_id', '==', studentId).get();
        const presentCount = attSnap.docs.filter(d => ['present', 'late'].includes(d.data().status)).length;
        
        const subSnap = await db.collection('submissions').where('student_id', '==', studentId).get();
        const courseAssigIds = assignmentsSnap.docs.map(d => d.id);
        const courseSubmissions = subSnap.docs.filter(d => courseAssigIds.includes(d.data().assignment_id));
        const submittedCount = courseSubmissions.length;
        
        const attendanceRatio = classes.length >= 3 ? (presentCount / classes.length) : 1.0;
        const pendingAssignments = totalAssignments - submittedCount;
        
        let isAtRisk = false;
        let riskReason = "";
        
        if (classes.length >= 3 && attendanceRatio < 0.75) {
            isAtRisk = true;
            riskReason += `asistencia baja (${Math.round(attendanceRatio * 100)}%) `;
        }
        
        if (pendingAssignments >= 2) {
            isAtRisk = true;
            riskReason += (riskReason ? "y " : "") + `tareas pendientes (${pendingAssignments} sin entregar) `;
        }
        
        if (isAtRisk) {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            
            const recentNotifSnap = await db.collection('notifications')
                .where('student_id', '==', studentId)
                .where('created_at', '>=', oneWeekAgo)
                .get();
                
            const alreadyNotified = recentNotifSnap.docs.some(d => d.data().message.includes("Alerta de Desempeño"));
            
            if (!alreadyNotified) {
                await db.collection('notifications').add({
                    student_id: studentId,
                    message: `⚠️ Alerta de Desempeño: Tu estado en la materia "${courseName}" requiere atención debido a: ${riskReason.trim()}.`,
                    link: `/dashboard/courses/${courseId}`,
                    read: false,
                    is_daily_pending: false,
                    created_at: admin.firestore.FieldValue.serverTimestamp()
                });
                alertsTriggered.push(studentId);
            }
        }
    }
    return { success: true, alertsTriggeredCount: alertsTriggered.length };
}

async function getStudentNotifications(payload, context) {
    const { uid, db } = context;
    const snap = await db.collection('notifications')
        .where('student_id', '==', uid)
        .orderBy('created_at', 'desc')
        .limit(30)
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

async function markNotificationsRead(payload, context) {
    const { uid, db } = context;
    const snap = await db.collection('notifications')
        .where('student_id', '==', uid)
        .where('read', '==', false)
        .get();
        
    const batch = db.batch();
    snap.docs.forEach(doc => {
        batch.update(doc.ref, { read: true });
    });
    await batch.commit();
    return { success: true };
}

module.exports = {
    notifyCourseStudents,
    checkAndAlertStudentsAtRisk,
    getStudentNotifications,
    markNotificationsRead
};
