const DEFAULT_TEMPLATES = {
    alert_risk: {
        id: "alert_risk",
        name: "Alerta de Riesgo Académico / Inasistencias",
        subject: "⚠️ Alerta de Rendimiento y Asistencia - {{course_name}}",
        body_html: `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 600px; color: #1e293b;">
    <h2 style="color: #d97706; margin-top: 0;">Estimado/a {{student_name}},</h2>
    <p>Te escribimos de la cátedra <strong>{{course_name}}</strong> para informarte que hemos detectado un nivel crítico en tu porcentaje de asistencia o entregas de trabajos prácticos.</p>
    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 16px 0; border-radius: 4px;">
        <p style="margin: 0; font-weight: bold; color: #92400e;">Resumen de Estado:</p>
        <p style="margin: 4px 0 0 0; color: #b45309;">Por favor ponete en contacto con los docentes o unite a los grupos de estudio para regularizar tu cursada.</p>
    </div>
    <p>Estamos a tu disposición para ayudarte a ponerte al día.</p>
    <p style="font-size: 12px; color: #64748b; margin-top: 24px; border-top: 1px solid #cbd5e1; padding-top: 12px;">Cátedra {{course_name}} — Ninja Dojo</p>
</div>`
    },
    direct_student: {
        id: "direct_student",
        name: "Mensaje Directo al Estudiante",
        subject: "Mensaje de Cátedra {{course_name}}",
        body_html: `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 600px; color: #1e293b;">
    <h3 style="color: #2563eb; margin-top: 0;">Hola {{student_name}},</h3>
    <div style="margin: 16px 0; line-height: 1.6;">
        {{message_body}}
    </div>
    <p style="font-size: 12px; color: #64748b; margin-top: 24px; border-top: 1px solid #cbd5e1; padding-top: 12px;">Enviado por el equipo docente de {{course_name}}</p>
</div>`
    },
    assignment_due: {
        id: "assignment_due",
        name: "Recordatorio de Entrega de Tarea",
        subject: "📅 Recordatorio de Entrega Próxima: {{assignment_title}}",
        body_html: `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 600px; color: #1e293b;">
    <h3 style="color: #059669; margin-top: 0;">Hola {{student_name}},</h3>
    <p>Te recordamos que la tarea <strong>{{assignment_title}}</strong> en la materia <strong>{{course_name}}</strong> vence próximamente ({{due_date}}).</p>
    <p>Asegurate de subir tus cambios a tu repositorio de GitHub o entregar desde la plataforma.</p>
    <p style="font-size: 12px; color: #64748b; margin-top: 24px; border-top: 1px solid #cbd5e1; padding-top: 12px;">Sistema Ninja Dojo</p>
</div>`
    }
};

async function getEmailTemplates(payload, context) {
    const { db } = context;
    const { courseId } = payload;

    if (!courseId) {
        return DEFAULT_TEMPLATES;
    }

    const snap = await db.collection("email_templates").where("course_id", "==", courseId).get();
    const customTemplates = {};
    snap.docs.forEach(doc => {
        const data = doc.data();
        customTemplates[data.template_id] = { id: data.template_id, ...data };
    });

    return {
        ...DEFAULT_TEMPLATES,
        ...customTemplates
    };
}

async function saveEmailTemplate(payload, context) {
    const { uid, db, admin } = context;
    const { courseId, templateId, name, subject, bodyHtml } = payload;

    if (!courseId || !templateId || !subject || !bodyHtml) {
        throw new Error("Parámetros 'courseId', 'templateId', 'subject' y 'bodyHtml' requeridos.");
    }

    const docId = `${courseId}_${templateId}`;
    await db.collection("email_templates").doc(docId).set({
        course_id: courseId,
        template_id: templateId,
        name: name || templateId,
        subject: subject,
        body_html: bodyHtml,
        updated_by: uid,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return { success: true, docId };
}

module.exports = {
    getEmailTemplates,
    saveEmailTemplate,
    DEFAULT_TEMPLATES
};
