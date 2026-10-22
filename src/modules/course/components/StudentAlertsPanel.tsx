"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { showToast } from "@/components/dashboard/ui/ToastNotification";
import ModalShell from "@/components/dashboard/ui/ModalShell";

type AlertStatus = "active" | "contacted" | "snoozed" | "resolved";

interface StudentAlert {
  id: string;
  student_id: string;
  full_name: string;
  email: string;
  commission: string | null;
  type: string;
  label: string;
  status: AlertStatus;
  message: string;
}

interface ContactLog {
  id: string;
  actor_name: string;
  channel: string;
  summary: string;
  scheduled_for: string | null;
  created_at: number | null;
}

const CHANNELS: { id: string; label: string }[] = [
  { id: "email", label: "Email" },
  { id: "discord", label: "Discord" },
  { id: "moodle", label: "Moodle" },
  { id: "presencial", label: "Presencial" },
  { id: "tutoria", label: "Tutoría" },
  { id: "otro", label: "Otro" },
];

const STATUS_STYLE: Record<AlertStatus, string> = {
  active: "bg-red-950/60 border-red-700/60 text-red-300",
  contacted: "bg-blue-950/60 border-blue-700/60 text-blue-300",
  snoozed: "bg-neutral-800 border-neutral-700 text-gray-400",
  resolved: "bg-emerald-950/60 border-emerald-700/60 text-emerald-300",
};
const STATUS_LABEL: Record<AlertStatus, string> = { active: "Activa", contacted: "En seguimiento", snoozed: "Pospuesta", resolved: "Resuelta" };

const inputClass = "w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white";

type Dialog =
  | { kind: "contacted"; alert: StudentAlert }
  | { kind: "tutoring"; alert: StudentAlert }
  | { kind: "timeline"; studentId: string; name: string };

/**
 * "Alumnos que requieren atención" (SPEC §1.3): alertas persistentes con
 * acciones en un clic y la bitácora de intervenciones de cada estudiante.
 */
export function StudentAlertsPanel({ courseId, commissionFilter, onEmail }: {
  courseId: string;
  commissionFilter: string;
  onEmail: (student: { id: string; email: string; full_name: string }) => void;
}) {
  const [alerts, setAlerts] = useState<StudentAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [form, setForm] = useState({ channel: "email", summary: "", dateTime: "", note: "" });
  const [timeline, setTimeline] = useState<ContactLog[]>([]);

  const load = useCallback(async () => {
    try {
      setAlerts(await api("getStudentAlerts", { courseId }) || []);
    } catch (err: any) {
      showToast("Error al cargar alertas: " + err.message, "error");
    }
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const r = await api("refreshStudentAlerts", { courseId });
      await load();
      showToast(`Alertas recalculadas: ${r.created} nuevas, ${r.resolved} resueltas solas.`, "success");
    } catch (err: any) {
      showToast("Error al recalcular: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const act = async (alert: StudentAlert, action: "snooze" | "resolve" | "reopen", days?: number) => {
    try {
      await api("updateStudentAlert", { alertId: alert.id, action, days });
      await load();
    } catch (err: any) {
      showToast("No se pudo actualizar la alerta: " + err.message, "error");
    }
  };

  const openTimeline = async (studentId: string, name: string) => {
    setDialog({ kind: "timeline", studentId, name });
    try {
      setTimeline(await api("getContactLogs", { courseId, studentId }) || []);
    } catch (err: any) {
      showToast("Error al cargar la bitácora: " + err.message, "error");
    }
  };

  const submitDialog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dialog || dialog.kind === "timeline") return;
    try {
      if (dialog.kind === "contacted") {
        await api("updateStudentAlert", { alertId: dialog.alert.id, action: "contacted", channel: form.channel, summary: form.summary || null });
      } else {
        await api("scheduleStudentTutoring", {
          courseId, studentId: dialog.alert.student_id, alertId: dialog.alert.id,
          dateTime: new Date(form.dateTime).toISOString(), note: form.note || null,
        });
        showToast("Tutoría agendada: el estudiante recibió un aviso.", "success");
      }
      setDialog(null);
      setForm({ channel: "email", summary: "", dateTime: "", note: "" });
      await load();
    } catch (err: any) {
      showToast("No se pudo guardar: " + err.message, "error");
    }
  };

  // Una tarjeta por estudiante con todas sus alertas abiertas.
  const students = useMemo(() => {
    const map = new Map<string, { id: string; name: string; email: string; alerts: StudentAlert[] }>();
    for (const a of alerts) {
      if (commissionFilter !== "Todas" && (a.commission || "Sin Comisión") !== commissionFilter) continue;
      const entry = map.get(a.student_id) || { id: a.student_id, name: a.full_name, email: a.email, alerts: [] };
      entry.alerts.push(a);
      map.set(a.student_id, entry);
    }
    return [...map.values()].sort((x, y) =>
      y.alerts.filter((a) => a.status === "active").length - x.alerts.filter((a) => a.status === "active").length
      || x.name.localeCompare(y.name, "es"));
  }, [alerts, commissionFilter]);

  return (
    <section className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 space-y-4" aria-labelledby="attention-title">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h3 id="attention-title" className="text-lg font-bold text-white">Alumnos que requieren atención</h3>
          <p className="text-xs text-gray-400 mt-1">Asistencia crítica, tareas atrasadas, sin repositorio y deserción silenciosa. Se recalcula todos los días a las 6:00.</p>
        </div>
        <button type="button" onClick={handleRefresh} disabled={loading}
          className="px-3 py-2 bg-neutral-950 border border-neutral-800 hover:bg-neutral-800 rounded-xl text-xs font-semibold text-gray-200 cursor-pointer disabled:opacity-50">
          {loading ? "Recalculando…" : "🔄 Recalcular ahora"}
        </button>
      </div>

      {students.length === 0 && <p className="text-xs text-gray-500">No hay alertas abiertas{commissionFilter !== "Todas" ? ` en ${commissionFilter}` : ""}.</p>}

      <ul className="space-y-3">
        {students.map((s) => (
          <li key={s.id} className="p-4 rounded-xl border border-neutral-800 bg-neutral-950 space-y-3">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <span className="font-semibold text-white text-sm">{s.name}</span>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <button type="button" onClick={() => onEmail({ id: s.id, email: s.email, full_name: s.name })} className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold text-white cursor-pointer">✉️ Enviar correo</button>
                <button type="button" onClick={() => setDialog({ kind: "tutoring", alert: s.alerts[0] })} className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg font-semibold text-gray-200 cursor-pointer">📅 Agendar tutoría</button>
                <button type="button" onClick={() => openTimeline(s.id, s.name)} className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg font-semibold text-gray-200 cursor-pointer">🗂️ Bitácora</button>
              </div>
            </div>
            <ul className="space-y-2">
              {s.alerts.map((a) => (
                <li key={a.id} className="flex flex-wrap justify-between items-center gap-2 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${STATUS_STYLE[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                    <span className="font-semibold text-amber-300">⚠️ {a.label}</span>
                    <span className="text-gray-400">{a.message}</span>
                  </div>
                  <div className="flex gap-2 text-[11px]">
                    {a.status === "active" && <button type="button" onClick={() => setDialog({ kind: "contacted", alert: a })} className="text-blue-400 hover:underline cursor-pointer">Contactado</button>}
                    {a.status !== "snoozed" && (
                      <select aria-label={`Posponer ${a.label}`} defaultValue="" onChange={(e) => { if (e.target.value) act(a, "snooze", Number(e.target.value)); }}
                        className="bg-neutral-900 border border-neutral-800 rounded px-1 py-0.5 text-gray-300 cursor-pointer">
                        <option value="">Posponer…</option>
                        <option value="3">3 días</option>
                        <option value="7">7 días</option>
                        <option value="14">14 días</option>
                      </select>
                    )}
                    {a.status === "snoozed" && <button type="button" onClick={() => act(a, "reopen")} className="text-gray-300 hover:underline cursor-pointer">Reactivar</button>}
                    <button type="button" onClick={() => act(a, "resolve")} className="text-emerald-400 hover:underline cursor-pointer">Resolver</button>
                  </div>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      {dialog && (
        <ModalShell onClose={() => setDialog(null)} ariaLabel={dialog.kind === "timeline" ? "Bitácora de contacto" : dialog.kind === "tutoring" ? "Agendar tutoría" : "Registrar contacto"}
          overlayClassName="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[9999]"
          className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl max-w-md w-full space-y-4 max-h-[85vh] overflow-y-auto">
          {dialog.kind === "timeline" ? (
            <>
              <h3 className="text-base font-bold text-white">Bitácora de {dialog.name}</h3>
              {timeline.length === 0 && <p className="text-xs text-gray-500">Todavía no hay intervenciones registradas.</p>}
              <ol className="space-y-3 border-l border-neutral-800 pl-4">
                {timeline.map((log) => (
                  <li key={log.id} className="text-xs">
                    <p className="text-gray-500">
                      {log.created_at ? new Date(log.created_at).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "—"} · {CHANNELS.find((c) => c.id === log.channel)?.label || log.channel} · {log.actor_name}
                    </p>
                    <p className="text-gray-200">{log.summary}</p>
                    {log.scheduled_for && <p className="text-gray-400">Para el {new Date(log.scheduled_for).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}</p>}
                  </li>
                ))}
              </ol>
              <button type="button" onClick={() => setDialog(null)} className="px-4 py-2 bg-neutral-800 rounded-xl text-xs font-semibold text-gray-200 cursor-pointer">Cerrar</button>
            </>
          ) : (
            <form onSubmit={submitDialog} className="space-y-3">
              <h3 className="text-base font-bold text-white">{dialog.kind === "tutoring" ? "Agendar tutoría" : "Registrar contacto"} · {dialog.alert.full_name}</h3>
              {dialog.kind === "contacted" ? (
                <>
                  <div>
                    <label htmlFor="contactChannel" className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Canal</label>
                    <select id="contactChannel" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} className={inputClass}>
                      {CHANNELS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="contactSummary" className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Resumen (opcional)</label>
                    <textarea id="contactSummary" rows={3} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} maxLength={2000} className={inputClass} />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label htmlFor="tutoringDate" className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Fecha y hora</label>
                    <input id="tutoringDate" type="datetime-local" required value={form.dateTime} onChange={(e) => setForm({ ...form, dateTime: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="tutoringNote" className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Nota para el estudiante (opcional)</label>
                    <input id="tutoringNote" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={1000} className={inputClass} />
                  </div>
                </>
              )}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setDialog(null)} className="px-4 py-2 bg-neutral-800 rounded-xl text-xs font-semibold text-gray-300 cursor-pointer">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold text-white cursor-pointer">Guardar</button>
              </div>
            </form>
          )}
        </ModalShell>
      )}
    </section>
  );
}
