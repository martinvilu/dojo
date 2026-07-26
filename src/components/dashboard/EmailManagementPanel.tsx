"use client";

import React, { useState, useEffect } from "react";

interface EmailManagementPanelProps {
  courseId: string;
  courseName: string;
  api: (action: string, payload?: any) => Promise<any>;
  gmailStatus: { connected: boolean; email: string | null };
  onStartGmailAuth?: () => void;
}

export default function EmailManagementPanel({
  courseId,
  courseName,
  api,
  gmailStatus,
  onStartGmailAuth
}: EmailManagementPanelProps) {
  const [subTab, setSubTab] = useState<"scheduled" | "templates" | "history">("scheduled");
  const [loading, setLoading] = useState(false);

  // Scheduled emails state
  const [scheduledEmails, setScheduledEmails] = useState<any[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [newScheduleTitle, setNewScheduleTitle] = useState("");
  const [newScheduleSubject, setNewScheduleSubject] = useState("");
  const [newScheduleBody, setNewScheduleBody] = useState("");
  const [newScheduleRecipientType, setNewScheduleRecipientType] = useState<"all_students" | "students_at_risk">("all_students");
  const [newScheduleDelayHours, setNewScheduleDelayHours] = useState(24);

  // Templates state
  const [templates, setTemplates] = useState<Record<string, any>>({});
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("alert_risk");
  const [editTemplateSubject, setEditTemplateSubject] = useState("");
  const [editTemplateBody, setEditTemplateBody] = useState("");

  // History / Audit logs state
  const [mailLogs, setMailLogs] = useState<any[]>([]);

  const loadData = async () => {
    if (!courseId) return;
    setLoading(true);
    try {
      if (subTab === "scheduled") {
        const res = await api("getScheduledEmails", { courseId });
        setScheduledEmails(res || []);
      } else if (subTab === "templates") {
        const res = await api("getEmailTemplates", { courseId });
        setTemplates(res || {});
        if (res?.alert_risk) {
          setEditTemplateSubject(res.alert_risk.subject || "");
          setEditTemplateBody(res.alert_risk.body_html || "");
        }
      } else if (subTab === "history") {
        const res = await api("getMailLogs", { courseId });
        setMailLogs(res || []);
      }
    } catch (e: any) {
      console.error("Error cargando panel de emails:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [courseId, subTab]);

  const handleSelectTemplate = (tId: string) => {
    setSelectedTemplateId(tId);
    if (templates[tId]) {
      setEditTemplateSubject(templates[tId].subject || "");
      setEditTemplateBody(templates[tId].body_html || "");
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api("saveEmailTemplate", {
        courseId,
        templateId: selectedTemplateId,
        name: templates[selectedTemplateId]?.name || selectedTemplateId,
        subject: editTemplateSubject,
        bodyHtml: editTemplateBody
      });
      alert("¡Plantilla de correo guardada exitosamente!");
      loadData();
    } catch (err: any) {
      alert("Error al guardar plantilla: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateScheduledEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScheduleSubject || !newScheduleBody) {
      alert("Completá el asunto y contenido del correo.");
      return;
    }
    setLoading(true);
    try {
      const sendAt = Date.now() + newScheduleDelayHours * 3600000;
      await api("createScheduledEmail", {
        courseId,
        title: newScheduleTitle || newScheduleSubject,
        recipientType: newScheduleRecipientType,
        subject: newScheduleSubject,
        bodyHtml: newScheduleBody,
        sendAt
      });
      alert("¡Correo programado con éxito!");
      setShowScheduleModal(false);
      setNewScheduleTitle("");
      setNewScheduleSubject("");
      setNewScheduleBody("");
      loadData();
    } catch (err: any) {
      alert("Error al programar correo: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerNow = async (emailId: string) => {
    if (!confirm("¿Deseás enviar este correo programado inmediatamente a los destinatarios?")) return;
    setLoading(true);
    try {
      const res = await api("triggerScheduledEmailNow", { emailId, courseId });
      alert(`¡Correo enviado! ${res.sentCount} correos entregados exitosamente.`);
      loadData();
    } catch (err: any) {
      alert("Error al ejecutar envío: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelScheduled = async (emailId: string) => {
    if (!confirm("¿Cancelar este correo programado?")) return;
    setLoading(true);
    try {
      await api("cancelScheduledEmail", { emailId });
      alert("Correo programado cancelado.");
      loadData();
    } catch (err: any) {
      alert("Error al cancelar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER CARD */}
      <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center space-x-2">
            <span>📧 Panel de Gestión y Automatización de Correos</span>
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            Programá notificaciones automáticas de alertas, ajustá plantillas institucionales y gestioná envíos masivos o directos para <strong>{courseName}</strong>.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {gmailStatus.connected ? (
            <span className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-mono font-bold flex items-center space-x-2 chip-status">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span>Gmail Conectado: {gmailStatus.email}</span>
            </span>
          ) : (
            <button
              onClick={onStartGmailAuth}
              className="btn-primary shadow-sm"
            >
              <span>🔑 Autorizar Cuenta Gmail</span>
            </button>
          )}
        </div>
      </div>

      {/* SUBTABS BAR */}
      <div className="flex border-b border-border-custom space-x-2">
        <button
          onClick={() => setSubTab("scheduled")}
          className={`px-4 py-2 text-xs font-semibold rounded-t transition cursor-pointer ${
            subTab === "scheduled" ? "bg-bg-secondary text-text-primary border-t-2 border-[#a10016]" : "text-text-secondary hover:text-text-primary"
          }`}
        >
          ⏰ Correos Programados ({scheduledEmails.length})
        </button>
        <button
          onClick={() => setSubTab("templates")}
          className={`px-4 py-2 text-xs font-semibold rounded-t transition cursor-pointer ${
            subTab === "templates" ? "bg-bg-secondary text-text-primary border-t-2 border-[#a10016]" : "text-text-secondary hover:text-text-primary"
          }`}
        >
          📝 Plantillas Personalizadas
        </button>
        <button
          onClick={() => setSubTab("history")}
          className={`px-4 py-2 text-xs font-semibold rounded-t transition cursor-pointer ${
            subTab === "history" ? "bg-bg-secondary text-text-primary border-t-2 border-[#a10016]" : "text-text-secondary hover:text-text-primary"
          }`}
        >
          📜 Historial de Envíos
        </button>
      </div>

      {/* SUBTAB 1: SCHEDULED EMAILS */}
      {subTab === "scheduled" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-bold text-text-primary uppercase tracking-wider">Cola de Correos Programados</h4>
            <button
              onClick={() => setShowScheduleModal(true)}
              className="btn-primary"
            >
              <span>+ Programar Nuevo Correo</span>
            </button>
          </div>

          {loading ? (
            <p className="text-xs text-text-secondary italic">Cargando correos programados...</p>
          ) : scheduledEmails.length === 0 ? (
            <div className="card-academic text-center text-text-secondary text-xs">
              <p className="font-semibold text-text-primary">No hay correos pendientes ni programados en este momento.</p>
              <p className="mt-1">Podés programar avisos de clase, recordatorios de entrega o alertas de inasistencias automáticas.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {scheduledEmails.map((item) => (
                <div key={item.id} className="card-academic flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-bold text-text-primary">{item.title || item.subject}</span>
                      <span className={`chip-status text-[10px] uppercase font-mono ${
                        item.status === "pending" ? "bg-amber-500/10 text-amber-600 border border-amber-500/30" :
                        item.status === "sent" ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30" :
                        "bg-red-500/10 text-red-600 border border-red-500/30"
                      }`}>
                        {item.status === "pending" ? "⏳ Pendiente" : item.status === "sent" ? `✓ Enviado (${item.sent_count || 0})` : "❌ Cancelado"}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary mt-1">Asunto: <span className="font-mono text-text-primary">{item.subject}</span></p>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      Destinatarios: {item.recipient_type === "all_students" ? "Todos los alumnos" : "Alumnos en riesgo"} • Programado para: {new Date(item.send_at).toLocaleString("es-AR")}
                    </p>
                  </div>

                  {item.status === "pending" && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleTriggerNow(item.id)}
                        className="btn-primary min-w-[100px]"
                      >
                        🚀 Enviar Ahora
                      </button>
                      <button
                        onClick={() => handleCancelScheduled(item.id)}
                        className="btn-secondary text-red-600"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: TEMPLATES */}
      {subTab === "templates" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Seleccionar Plantilla</h4>
            {Object.keys(templates).map((tKey) => {
              const tmpl = templates[tKey];
              return (
                <button
                  key={tKey}
                  onClick={() => handleSelectTemplate(tKey)}
                  className={`w-full text-left p-3 rounded-xl border text-xs transition cursor-pointer ${
                    selectedTemplateId === tKey
                      ? "bg-blue-600/10 border-blue-500 text-white font-bold"
                      : "bg-neutral-900 border-neutral-800 text-gray-400 hover:text-white"
                  }`}
                >
                  <p className="font-semibold">{tmpl.name || tKey}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5 truncate">{tmpl.subject}</p>
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSaveTemplate} className="md:col-span-2 bg-neutral-900 border border-neutral-800 p-5 rounded-2xl space-y-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider border-b border-neutral-800 pb-2">
              Editar Plantilla: {templates[selectedTemplateId]?.name || selectedTemplateId}
            </h4>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Asunto del Correo</label>
              <input
                type="text"
                value={editTemplateSubject}
                onChange={(e) => setEditTemplateSubject(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Cuerpo en HTML / Formato Rastro</label>
              <textarea
                value={editTemplateBody}
                onChange={(e) => setEditTemplateBody(e.target.value)}
                rows={10}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-4 text-xs text-white focus:outline-none focus:border-blue-500 font-mono leading-relaxed"
                required
              />
            </div>

            <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-850 text-[11px] text-gray-400 space-y-1 font-mono">
              <p className="font-bold text-gray-300 font-sans">Variables dinámicas disponibles:</p>
              <p><code className="text-amber-400">{`{{student_name}}`}</code> — Nombre completo del estudiante</p>
              <p><code className="text-amber-400">{`{{course_name}}`}</code> — Nombre de la materia ({courseName})</p>
              <p><code className="text-amber-400">{`{{message_body}}`}</code> — Mensaje personalizado en envíos directos</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition cursor-pointer"
            >
              💾 Guardar Cambios en Plantilla
            </button>
          </form>
        </div>
      )}

      {/* SUBTAB 3: MAIL AUDIT LOGS */}
      {subTab === "history" && (
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-white uppercase tracking-wider">Historial de Correos Enviados</h4>
          {loading ? (
            <p className="text-xs text-gray-400 italic">Cargando registros...</p>
          ) : mailLogs.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Aún no hay registros de correos enviados en esta cátedra.</p>
          ) : (
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-950 text-gray-400 uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Fecha y Hora</th>
                    <th className="p-3">Destinatario</th>
                    <th className="p-3">Asunto</th>
                    <th className="p-3">Estado / Envíos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800 text-gray-300">
                  {mailLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-neutral-850/50 transition">
                      <td className="p-3 font-mono text-gray-400">
                        {log.sent_at?.seconds ? new Date(log.sent_at.seconds * 1000).toLocaleString("es-AR") : new Date(log.sent_at || Date.now()).toLocaleString("es-AR")}
                      </td>
                      <td className="p-3 font-semibold text-white">
                        {log.student_name ? `${log.student_name} (${log.student_email})` : "Envío Masivo"}
                      </td>
                      <td className="p-3 font-mono text-gray-300">{log.subject}</td>
                      <td className="p-3">
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                          ✓ Enviado {log.sent_count ? `(${log.sent_count})` : ""}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SCHEDULE MAIL MODAL */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl max-w-lg w-full min-w-[280px] sm:min-w-[480px] shrink-0 mx-auto max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl relative z-10">
            <h3 className="text-base font-bold text-white flex justify-between items-center">
              <span>⏰ Programar Nuevo Correo Automático</span>
              <button onClick={() => setShowScheduleModal(false)} className="text-gray-400 hover:text-white" aria-label="Cerrar modal">✕</button>
            </h3>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Título Interno del Correo</label>
              <input
                type="text"
                value={newScheduleTitle}
                onChange={(e) => setNewScheduleTitle(e.target.value)}
                placeholder="Ej: Recordatorio Entrega TP2"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Destinatarios</label>
              <select
                value={newScheduleRecipientType}
                onChange={(e: any) => setNewScheduleRecipientType(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="all_students">👥 Todos los Estudiantes de la Cátedra</option>
                <option value="students_at_risk">⚠️ Estudiantes con Alertas o Inasistencias Críticas</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Asunto del Correo</label>
              <input
                type="text"
                value={newScheduleSubject}
                onChange={(e) => setNewScheduleSubject(e.target.value)}
                placeholder="Ej: ⚠️ Alerta de Inasistencias - {{student_name}}"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Contenido (HTML / Texto)</label>
              <textarea
                value={newScheduleBody}
                onChange={(e) => setNewScheduleBody(e.target.value)}
                rows={5}
                placeholder="Hola {{student_name}}, te escribimos de {{course_name}}..."
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Ejecutar envío en (horas)</label>
              <input
                type="number"
                value={newScheduleDelayHours}
                onChange={(e) => setNewScheduleDelayHours(Number(e.target.value))}
                min={1}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-gray-300 text-xs font-bold rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateScheduledEmail}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl"
              >
                Guardar y Programar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
