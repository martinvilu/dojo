const { refreshCourseAlerts } = require('./alerts');

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

/**
 * Recalcula las alertas tempranas del curso (motor de `alerts.js`) y avisa a
 * cada estudiante con alertas activas, como mucho una vez por semana.
 */
async function checkAndAlertStudentsAtRisk(payload, context) {
    const { db, admin } = context;
    const { courseId } = payload;
    const courseSnap = await db.collection('courses').doc(courseId).get();
    if (!courseSnap.exists) throw new Error("Curso no encontrado");
    const courseName = courseSnap.data().name;

    await refreshCourseAlerts(db, courseId, admin);
    const alertsSnap = await db.collection('student_alerts').where('course_id', '==', courseId).get();
    const byStudent = {};
    for (const doc of alertsSnap.docs) {
        const a = doc.data();
        if (a.status === 'active') (byStudent[a.student_id] ||= []).push(a.message);
    }

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const alertsTriggered = [];
    for (const [studentId, messages] of Object.entries(byStudent)) {
        const recentNotifSnap = await db.collection('notifications')
            .where('student_id', '==', studentId)
            .where('created_at', '>=', oneWeekAgo)
            .get();
        const alreadyNotified = recentNotifSnap.docs.some(d => String(d.data().message || "").includes("Alerta de Desempeño"));
        if (alreadyNotified) continue;
        await db.collection('notifications').add({
            student_id: studentId,
            message: `⚠️ Alerta de Desempeño: Tu estado en la materia "${courseName}" requiere atención: ${messages.join(' ')}`,
            link: `/dashboard?courseId=${courseId}&subTab=academic`,
            read: false,
            is_daily_pending: false,
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });
        alertsTriggered.push(studentId);
    }
    return { success: true, alertsTriggeredCount: alertsTriggered.length, studentsWithAlerts: Object.keys(byStudent).length };
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

async function sendDailySummaries(event) {
    const { getFirestore, FieldValue } = require("firebase-admin/firestore");
    const logger = require("firebase-functions/logger");
    const db = getFirestore();

    try {
        const snap = await db.collection('notifications').where('is_daily_pending', '==', true).get();
        if (snap.empty) return null;
        
        const byStudent = {};
        for (let doc of snap.docs) {
            const data = doc.data();
            const studentId = data.student_id;
            if (!byStudent[studentId]) byStudent[studentId] = [];
            byStudent[studentId].push({ id: doc.id, ...data });
        }
        
        const promises = [];
        for (const [studentId, notifs] of Object.entries(byStudent)) {
            const batch = db.batch();
            
            for (const n of notifs) {
                batch.delete(db.collection('notifications').doc(n.id));
            }
            
            const summaryRef = db.collection('notifications').doc();
            batch.set(summaryRef, {
                student_id: studentId,
                message: `Resumen Diario: Tenés ${notifs.length} nuevas actualizaciones (calificaciones, cambios de clase, etc.)`,
                link: '/estudiante/notificaciones',
                read: false,
                created_at: FieldValue.serverTimestamp()
            });
            
            promises.push(batch.commit());
        }
        
        await Promise.all(promises);
        logger.info(`Sent daily summaries to ${Object.keys(byStudent).length} students.`);
    } catch (e) {
        logger.error('Error sending daily summaries:', e);
    }
    return null;
}

module.exports = {
    notifyCourseStudents,
    checkAndAlertStudentsAtRisk,
    getStudentNotifications,
    markNotificationsRead,
    sendDailySummaries
};

