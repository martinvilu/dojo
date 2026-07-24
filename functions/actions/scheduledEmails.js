const { sendGmailNotification } = require('./gmailAuth');

async function getScheduledEmails(payload, context) {
    const { db } = context;
    const { courseId } = payload;
    if (!courseId) throw new Error("Parámetro 'courseId' requerido.");

    const snap = await db.collection("scheduled_emails")
        .where("course_id", "==", courseId)
        .get();

    const emails = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Sort locally by send_at or created_at descending
    emails.sort((a, b) => (b.send_at || b.created_at || 0) - (a.send_at || a.created_at || 0));

    return emails;
}

async function createScheduledEmail(payload, context) {
    const { uid, db, admin } = context;
    const { courseId, title, recipientType, targetStudentId, subject, bodyHtml, sendAt } = payload;

    if (!courseId || !subject || !bodyHtml) {
        throw new Error("Parámetros 'courseId', 'subject' y 'bodyHtml' requeridos.");
    }

    const docRef = await db.collection("scheduled_emails").add({
        course_id: courseId,
        title: title || subject,
        recipient_type: recipientType || "all_students", // "all_students" | "students_at_risk" | "single_student"
        target_student_id: targetStudentId || null,
        subject: subject,
        body_html: bodyHtml,
        status: "pending", // "pending" | "sent" | "cancelled"
        send_at: sendAt || Date.now() + 3600000, // Default 1 hour from now
        created_by: uid,
        created_at: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, id: docRef.id };
}

async function cancelScheduledEmail(payload, context) {
    const { db } = context;
    const { emailId } = payload;
    if (!emailId) throw new Error("ID de correo programado requerido.");

    await db.collection("scheduled_emails").doc(emailId).update({
        status: "cancelled"
    });

    return { success: true };
}

async function triggerScheduledEmailNow(payload, context) {
    const { uid, db, admin } = context;
    const { emailId, courseId } = payload;
    if (!emailId || !courseId) throw new Error("Parámetros 'emailId' y 'courseId' requeridos.");

    const docRef = db.collection("scheduled_emails").doc(emailId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) throw new Error("Correo programado no encontrado.");

    const emailData = docSnap.data();
    if (emailData.status === "cancelled") throw new Error("Este correo fue cancelado.");

    // Fetch target recipients
    let recipients = [];
    if (emailData.recipient_type === "single_student" && emailData.target_student_id) {
        const pSnap = await db.collection("profiles").doc(emailData.target_student_id).get();
        if (pSnap.exists && pSnap.data().email) {
            recipients.push({
                student_id: emailData.target_student_id,
                email: pSnap.data().email,
                name: pSnap.data().full_name || pSnap.data().email
            });
        }
    } else {
        const rosterSnap = await db.collection("course_roster").where("course_id", "==", courseId).get();
        for (let rDoc of rosterSnap.docs) {
            const rData = rDoc.data();
            const pSnap = await db.collection("profiles").doc(rData.student_id).get();
            if (pSnap.exists && pSnap.data().email) {
                recipients.push({
                    student_id: rData.student_id,
                    email: pSnap.data().email,
                    name: pSnap.data().full_name || pSnap.data().email
                });
            }
        }
    }

    let sentCount = 0;
    let failedCount = 0;

    for (let r of recipients) {
        const formattedSubject = emailData.subject.replace(/{{student_name}}/g, r.name);
        const formattedBody = emailData.body_html
            .replace(/{{student_name}}/g, r.name)
            .replace(/{{student_email}}/g, r.email);

        try {
            await sendGmailNotification({
                to: r.email,
                subject: formattedSubject,
                htmlBody: formattedBody
            }, context);
            sentCount++;
        } catch (e) {
            console.error(`Error enviando correo programado a ${r.email}:`, e);
            failedCount++;
        }
    }

    await docRef.update({
        status: "sent",
        executed_at: admin.firestore.FieldValue.serverTimestamp(),
        sent_count: sentCount,
        failed_count: failedCount
    });

    // Log to mail audit log
    await db.collection("mail_logs").add({
        course_id: courseId,
        title: emailData.title,
        subject: emailData.subject,
        sent_count: sentCount,
        failed_count: failedCount,
        sent_by: uid,
        sent_at: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, sentCount, failedCount };
}

async function sendDirectStudentEmail(payload, context) {
    const { uid, db, admin } = context;
    const { studentId, courseId, subject, bodyHtml } = payload;

    if (!studentId || !subject || !bodyHtml) {
        throw new Error("Parámetros 'studentId', 'subject' y 'bodyHtml' requeridos.");
    }

    const pSnap = await db.collection("profiles").doc(studentId).get();
    if (!pSnap.exists || !pSnap.data().email) {
        throw new Error("El estudiante no posee un correo electrónico registrado.");
    }

    const studentProfile = pSnap.data();
    const studentName = studentProfile.full_name || studentProfile.email;

    let courseName = "Cátedra";
    if (courseId) {
        const cSnap = await db.collection("courses").doc(courseId).get();
        if (cSnap.exists) courseName = cSnap.data().name || "Cátedra";
    }

    const formattedSubject = subject
        .replace(/{{student_name}}/g, studentName)
        .replace(/{{course_name}}/g, courseName);

    const formattedBody = bodyHtml
        .replace(/{{student_name}}/g, studentName)
        .replace(/{{course_name}}/g, courseName)
        .replace(/{{message_body}}/g, bodyHtml);

    const sendRes = await sendGmailNotification({
        to: studentProfile.email,
        subject: formattedSubject,
        htmlBody: formattedBody
    }, context);

    // Add to mail_logs
    await db.collection("mail_logs").add({
        course_id: courseId || null,
        target_student_id: studentId,
        student_email: studentProfile.email,
        student_name: studentName,
        subject: formattedSubject,
        sent_by: uid,
        sent_at: admin.firestore.FieldValue.serverTimestamp(),
        message_id: sendRes.messageId || null
    });

    return { success: true, emailSentTo: studentProfile.email };
}

async function getMailLogs(payload, context) {
    const { db } = context;
    const { courseId } = payload;

    let query = db.collection("mail_logs");
    if (courseId) {
        query = query.where("course_id", "==", courseId);
    }

    const snap = await query.get();
    const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    logs.sort((a, b) => (b.sent_at || 0) - (a.sent_at || 0));

    return logs;
}

module.exports = {
    getScheduledEmails,
    createScheduledEmail,
    cancelScheduledEmail,
    triggerScheduledEmailNow,
    sendDirectStudentEmail,
    getMailLogs
};
