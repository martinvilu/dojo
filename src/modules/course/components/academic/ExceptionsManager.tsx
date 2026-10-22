"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { showToast } from "@/components/dashboard/ui/ToastNotification";
import { confirmAction } from "@/components/dashboard/ui/ConfirmDialog";
import { EXCEPTION_LABELS, type CourseAssignment, type CourseException, type ExceptionType, type RosterStudent } from "./types";

const inputClass = "w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white";
const EMPTY_FORM = { studentId: "", type: "attendance_waiver" as ExceptionType, assignmentId: "", extraHours: "48", reason: "" };

/** Excepciones individuales justificadas: se otorgan y se revocan, nunca se borran. */
export function ExceptionsManager({ courseId, roster, assignments }: {
  courseId: string;
  roster: RosterStudent[];
  assignments: CourseAssignment[];
}) {
  const [exceptions, setExceptions] = useState<CourseException[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showRevoked, setShowRevoked] = useState(false);

  const load = useCallback(async () => {
    try {
      setExceptions(await api("getExceptions", { courseId }) || []);
    } catch (err: any) {
      showToast("Error al cargar excepciones: " + err.message, "error");
    }
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

  const studentName = (id: string) => {
    const s = roster.find((r) => r.id === id);
    return s ? s.full_name || s.email || id : id;
  };
  const assignmentTitle = (id: string | null) => assignments.find((a) => a.id === id)?.title || id || "";
  const needsAssignment = form.type !== "attendance_waiver";

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api("grantException", {
        courseId,
        studentId: form.studentId,
        type: form.type,
        assignmentId: needsAssignment ? form.assignmentId : null,
        extraHours: form.type === "deadline_extension" ? Number(form.extraHours) : null,
        reason: form.reason,
      });
      setForm(EMPTY_FORM);
      await load();
      showToast("Excepción otorgada.", "success");
    } catch (err: any) {
      showToast("No se pudo otorgar: " + err.message, "error");
    }
  };

  const handleRevoke = async (exception: CourseException) => {
    if (!(await confirmAction({ message: `¿Revocar «${EXCEPTION_LABELS[exception.type]}» de ${studentName(exception.student_id)}? Queda registrado en la auditoría.`, tone: "danger" }))) return;
    try {
      await api("revokeException", { exceptionId: exception.id });
      await load();
    } catch (err: any) {
      showToast("No se pudo revocar: " + err.message, "error");
    }
  };

  const visible = exceptions.filter((e) => showRevoked || !e.revoked);
  const students = roster.filter((s) => s.role === undefined || s.role === "student");

  return (
    <div className="space-y-6">
      <form onSubmit={handleGrant} className="bg-neutral-900/60 p-4 rounded-2xl border border-neutral-800 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div>
          <label htmlFor="excStudent" className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Estudiante</label>
          <select id="excStudent" value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} required className={inputClass}>
            <option value="">Elegí un estudiante</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.full_name || s.email} {s.matricula_unrn ? `(${s.matricula_unrn})` : ""}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="excType" className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Tipo</label>
          <select id="excType" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ExceptionType })} className={inputClass}>
            {(Object.keys(EXCEPTION_LABELS) as ExceptionType[]).map((t) => <option key={t} value={t}>{EXCEPTION_LABELS[t]}</option>)}
          </select>
        </div>
        {needsAssignment && (
          <div>
            <label htmlFor="excAssignment" className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Trabajo práctico</label>
            <select id="excAssignment" value={form.assignmentId} onChange={(e) => setForm({ ...form, assignmentId: e.target.value })} required className={inputClass}>
              <option value="">Elegí un TP</option>
              {assignments.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
          </div>
        )}
        {form.type === "deadline_extension" && (
          <div>
            <label htmlFor="excHours" className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Horas de prórroga</label>
            <input id="excHours" type="number" min={1} max={1440} value={form.extraHours} onChange={(e) => setForm({ ...form, extraHours: e.target.value })} required className={inputClass} />
          </div>
        )}
        <div className="md:col-span-3">
          <label htmlFor="excReason" className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Justificación</label>
          <input id="excReason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Ej: certificado laboral presentado el 12/04" minLength={3} maxLength={2000} required className={inputClass} />
        </div>
        <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold cursor-pointer">Otorgar</button>
      </form>

      <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
        <input type="checkbox" checked={showRevoked} onChange={(e) => setShowRevoked(e.target.checked)} className="rounded bg-neutral-950 border-neutral-800" />
        Mostrar revocadas
      </label>

      <ul className="space-y-2">
        {visible.length === 0 && <li className="text-xs text-gray-500">No hay excepciones otorgadas.</li>}
        {visible.map((e) => (
          <li key={e.id} className={`flex justify-between items-start gap-3 p-3 rounded-xl border text-xs ${e.revoked ? "border-neutral-850 bg-neutral-950/40 opacity-60" : "border-neutral-800 bg-neutral-950"}`}>
            <div>
              <p className="font-semibold text-white">
                {studentName(e.student_id)} · {EXCEPTION_LABELS[e.type]}
                {e.assignment_id && <> · {assignmentTitle(e.assignment_id)}</>}
                {e.extra_hours && <> · +{e.extra_hours} h</>}
                {e.revoked && <span className="ml-2 text-red-400">Revocada</span>}
              </p>
              <p className="text-gray-400 mt-0.5">{e.reason}{e.granted_by_name && ` — ${e.granted_by_name}`}</p>
            </div>
            {!e.revoked && (
              <button type="button" onClick={() => handleRevoke(e)} className="text-red-400 hover:text-red-300 underline cursor-pointer shrink-0">Revocar</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
