"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { showToast } from "@/components/dashboard/ui/ToastNotification";
import { confirmAction } from "@/components/dashboard/ui/ConfirmDialog";
import { useBeforeUnload } from "@/hooks/useBeforeUnload";
import type { Assessment, AssessmentGrade, RosterStudent } from "./types";

type Draft = { grade: string; absent: boolean };

const inputClass = "w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white";

/** Alta de parciales/recuperatorios y planilla de notas por evaluación. */
export function AssessmentsManager({ courseId, roster, commissions }: {
  courseId: string;
  roster: RosterStudent[];
  commissions: string[];
}) {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [grades, setGrades] = useState<AssessmentGrade[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ kind: "parcial" as Assessment["kind"], label: "", recovers: "", date: "", commission: "" });
  const [importText, setImportText] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api("getAssessments", { courseId });
      setAssessments(res.assessments || []);
      setGrades(res.grades || []);
    } catch (err: any) {
      showToast("Error al cargar parciales: " + err.message, "error");
    }
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

  const selected = assessments.find((a) => a.id === selectedId) || null;
  const parciales = assessments.filter((a) => a.kind === "parcial");
  const labelOf = (id: string | null) => assessments.find((a) => a.id === id)?.label || "—";

  const students = useMemo(() => roster
    .filter((s) => s.role === undefined || s.role === "student")
    .filter((s) => !selected?.commission || s.commissions?.[courseId] === selected.commission)
    .sort((a, b) => (a.full_name || a.email || "").localeCompare(b.full_name || b.email || "", "es")), [roster, selected, courseId]);

  const savedFor = (studentId: string): Draft => {
    const g = grades.find((x) => x.assessment_id === selectedId && x.student_id === studentId);
    return { grade: g?.grade || "", absent: Boolean(g?.absent) };
  };
  const valueFor = (studentId: string): Draft => drafts[studentId] || savedFor(studentId);
  const dirtyIds = Object.keys(drafts).filter((id) => {
    const saved = savedFor(id);
    return drafts[id].grade !== saved.grade || drafts[id].absent !== saved.absent;
  });
  useBeforeUnload(dirtyIds.length > 0);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { id } = await api("createAssessment", {
        courseId,
        kind: form.kind,
        label: form.label,
        recovers: form.kind === "recuperatorio" ? form.recovers : null,
        date: form.date || null,
        commission: form.commission || null,
      });
      setForm({ kind: "parcial", label: "", recovers: "", date: "", commission: "" });
      await load();
      setSelectedId(id);
      showToast("Evaluación creada.", "success");
    } catch (err: any) {
      showToast("Error al crear la evaluación: " + err.message, "error");
    }
  };

  const handleArchive = async (assessment: Assessment) => {
    if (!(await confirmAction({ message: `¿Archivar ${assessment.label}? Deja de contar para la condición de los estudiantes.`, tone: "danger" }))) return;
    try {
      await api("archiveAssessment", { assessmentId: assessment.id });
      if (selectedId === assessment.id) setSelectedId("");
      await load();
    } catch (err: any) {
      showToast("Error al archivar: " + err.message, "error");
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    const failed: { id: string; message: string }[] = [];
    for (const studentId of dirtyIds) {
      try {
        await api("gradeAssessment", { assessmentId: selectedId, studentId, grade: drafts[studentId].grade, absent: drafts[studentId].absent });
      } catch (err: any) {
        failed.push({ id: studentId, message: err.message });
      }
    }
    await load();
    // Solo quedan como borrador las notas que no se pudieron guardar.
    setDrafts((prev) => Object.fromEntries(failed.map(({ id }) => [id, prev[id]])));
    setSaving(false);
    if (failed.length) {
      const first = roster.find((r) => r.id === failed[0].id);
      showToast(`No se guardaron ${failed.length} notas. ${first?.full_name || failed[0].id}: ${failed[0].message}`, "error");
    } else {
      showToast("Notas guardadas.", "success");
    }
  };

  /** Pegado desde planilla: una fila por estudiante, "UNRN-1234;7,5" o "UNRN-1234;ausente". */
  const handleImport = async () => {
    const rows = importText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
      const [matricula, value = ""] = line.split(/[;,\t]/).map((p) => p.trim());
      const absent = /^ausente$/i.test(value);
      return { matricula, grade: absent ? "" : value, absent };
    });
    if (rows.length === 0) return;
    try {
      const res = await api("importAssessmentGrades", { assessmentId: selectedId, rows });
      await load();
      setImportText("");
      showToast(`Importadas ${res.updated} notas${res.rejected.length ? `; ${res.rejected.length} rechazadas (${res.rejected[0].row}: ${res.rejected[0].reason})` : ""}.`,
        res.rejected.length ? "warning" : "success");
    } catch (err: any) {
      showToast("Error al importar: " + err.message, "error");
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreate} className="bg-neutral-900/60 p-4 rounded-2xl border border-neutral-800 grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
        <div>
          <label htmlFor="assessmentKind" className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Tipo</label>
          <select id="assessmentKind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Assessment["kind"] })} className={inputClass}>
            <option value="parcial">Parcial</option>
            <option value="recuperatorio">Recuperatorio</option>
          </select>
        </div>
        <div>
          <label htmlFor="assessmentLabel" className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Nombre</label>
          <input id="assessmentLabel" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder={form.kind === "parcial" ? "P1" : "R1"} maxLength={60} required className={inputClass} />
        </div>
        {form.kind === "recuperatorio" && (
          <div>
            <label htmlFor="assessmentRecovers" className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Recupera</label>
            <select id="assessmentRecovers" value={form.recovers} onChange={(e) => setForm({ ...form, recovers: e.target.value })} required className={inputClass}>
              <option value="">Elegí un parcial</option>
              {parciales.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="assessmentDate" className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Fecha</label>
          <input id="assessmentDate" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label htmlFor="assessmentCommission" className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Comisión</label>
          <select id="assessmentCommission" value={form.commission} onChange={(e) => setForm({ ...form, commission: e.target.value })} className={inputClass}>
            <option value="">Todas</option>
            {commissions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold cursor-pointer">➕ Agregar</button>
      </form>

      <div className="flex flex-wrap gap-2">
        {assessments.length === 0 && <p className="text-xs text-gray-500">Todavía no hay parciales cargados.</p>}
        {assessments.map((a) => (
          <div key={a.id} className={`flex items-center rounded-xl border text-xs ${selectedId === a.id ? "border-blue-500 bg-neutral-900" : "border-neutral-800 bg-neutral-950"}`}>
            <button type="button" onClick={() => { setSelectedId(a.id); setDrafts({}); }} aria-pressed={selectedId === a.id}
              className="px-3 py-1.5 text-left cursor-pointer">
              <span className="font-bold text-white">{a.label}</span>
              <span className="text-gray-500"> · {a.kind === "parcial" ? "Parcial" : `Recupera ${labelOf(a.recovers)}`}{a.commission ? ` · ${a.commission}` : ""}{a.date ? ` · ${a.date}` : ""}</span>
            </button>
            <button type="button" onClick={() => handleArchive(a)} aria-label={`Archivar ${a.label}`} className="px-2 py-1.5 text-gray-500 hover:text-red-400 cursor-pointer">✕</button>
          </div>
        ))}
      </div>

      {selected && (
        <div className="space-y-4">
          <div className="overflow-x-auto border border-neutral-800 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-950 text-[10px] text-gray-500 uppercase tracking-wider">
                <tr><th className="px-3 py-2 font-bold">Estudiante</th><th className="px-3 py-2 font-bold w-32">Nota (0–10)</th><th className="px-3 py-2 font-bold w-24">Ausente</th></tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const value = valueFor(s.id);
                  const setDraft = (patch: Partial<Draft>) => setDrafts((prev) => ({ ...prev, [s.id]: { ...value, ...patch } }));
                  return (
                    <tr key={s.id} className="border-t border-neutral-850">
                      <td className="px-3 py-1.5">
                        <span className="font-semibold text-white">{s.full_name || s.email}</span>
                        <span className="ml-2 text-[10px] text-gray-500 font-mono">{s.matricula_unrn || ""}</span>
                      </td>
                      <td className="px-3 py-1.5">
                        <input value={value.grade} disabled={value.absent} onChange={(e) => setDraft({ grade: e.target.value })} inputMode="decimal"
                          aria-label={`Nota de ${s.full_name || s.email}`} className={`${inputClass} py-1.5 disabled:opacity-40`} />
                      </td>
                      <td className="px-3 py-1.5">
                        <input type="checkbox" checked={value.absent} onChange={(e) => setDraft({ absent: e.target.checked, grade: e.target.checked ? "" : value.grade })}
                          aria-label={`${s.full_name || s.email} ausente`} className="rounded bg-neutral-950 border-neutral-800" />
                      </td>
                    </tr>
                  );
                })}
                {students.length === 0 && <tr><td colSpan={3} className="px-3 py-6 text-center text-gray-500">No hay estudiantes en el padrón{selected.commission ? ` de ${selected.commission}` : ""}.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={handleSaveAll} disabled={saving || dirtyIds.length === 0}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-40">
              {saving ? "Guardando…" : dirtyIds.length ? `Guardar ${dirtyIds.length} notas` : "Sin cambios"}
            </button>
          </div>
          <details className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-4">
            <summary className="text-xs font-semibold text-gray-300 cursor-pointer">📋 Pegar notas desde una planilla</summary>
            <p className="text-[11px] text-gray-500 mt-2">Una fila por estudiante: <code>UNRN-1234;7,5</code> o <code>UNRN-1234;ausente</code>.</p>
            <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={5} aria-label="Notas a importar"
              className={`${inputClass} mt-2 font-mono`} placeholder={"UNRN-10010;8\nUNRN-10011;ausente"} />
            <button type="button" onClick={handleImport} disabled={!importText.trim()}
              className="mt-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-gray-200 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-40">
              Importar en {selected.label}
            </button>
          </details>
        </div>
      )}
    </div>
  );
}
