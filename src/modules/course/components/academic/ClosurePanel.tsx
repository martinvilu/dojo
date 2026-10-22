"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { showToast } from "@/components/dashboard/ui/ToastNotification";
import { confirmAction } from "@/components/dashboard/ui/ConfirmDialog";
import { ConditionChip } from "./ConditionChip";
import type { AcademicCondition, ConditionsResponse, GradingRules } from "./types";

interface ActaVersion {
  version: number;
  hash: string;
  intact: boolean;
  students: number;
  summary: Partial<Record<AcademicCondition, number>>;
  closed_by_name: string;
  closed_at: string | null;
}

interface ClosureStatus {
  status: "open" | "closed" | "reopened";
  version: number;
  hash?: string;
  reopen_reason?: string;
  history: { event: "closed" | "reopened"; version: number; by_name: string; at: string; note: string }[];
  actas: ActaVersion[];
}

type SimKey = "min_attendance" | "partial_pass_grade" | "promotion_grade" | "promotion_ok_ratio" | "max_late_for_promotion" | "allow_promotion_via_recovery";

const SIM_FIELDS: { key: SimKey; label: string; kind: "percent" | "grade" | "int" | "bool" }[] = [
  { key: "min_attendance", label: "Asistencia mínima", kind: "percent" },
  { key: "partial_pass_grade", label: "Nota para aprobar", kind: "grade" },
  { key: "promotion_grade", label: "Nota de promoción", kind: "grade" },
  { key: "promotion_ok_ratio", label: "TPs en OK para promocionar", kind: "percent" },
  { key: "max_late_for_promotion", label: "Máx. entregas tarde para promocionar", kind: "int" },
  { key: "allow_promotion_via_recovery", label: "Promociona por recuperatorio", kind: "bool" },
];

const CONDITIONS: AcademicCondition[] = ["Promocionado", "Regular", "Condicional", "EN RIESGO", "Ausente", "Baja"];
const inputClass = "w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white";
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "—");

function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Cierre de cursada (UC-D17): simulador con reglas hipotéticas, casos borde,
 * congelamiento del acta con hash SHA-256, reapertura justificada y CSV para
 * SIU Guaraní. Cerrar y reabrir lo valida el backend (solo titular).
 */
export function ClosurePanel({ courseId }: { courseId: string }) {
  const [status, setStatus] = useState<ClosureStatus | null>(null);
  const [current, setCurrent] = useState<ConditionsResponse | null>(null);
  const [simulated, setSimulated] = useState<ConditionsResponse | null>(null);
  const [sim, setSim] = useState<Partial<Pick<GradingRules, SimKey>>>({});
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [closure, conditions] = await Promise.all([
        api("getCourseClosure", { courseId }),
        api("getAcademicConditions", { courseId }),
      ]);
      setStatus(closure);
      setCurrent(conditions);
      setSim(Object.fromEntries(SIM_FIELDS.map((f) => [f.key, conditions.rules[f.key]])));
    } catch (err: any) {
      showToast("Error al cargar el cierre: " + err.message, "error");
    }
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

  const changes = useMemo(() => {
    if (!current || !simulated) return [];
    const before = new Map(current.results.map((r) => [r.student_id, r.condition]));
    return simulated.results
      .filter((r) => before.get(r.student_id) !== r.condition)
      .map((r) => ({ id: r.student_id, name: r.full_name || r.email || r.student_id, from: before.get(r.student_id)!, to: r.condition }));
  }, [current, simulated]);

  const edgeCases = (current?.results || []).filter((r) => r.near_promotion || r.near_regularity);
  const closed = status?.status === "closed";

  const runSimulation = async () => {
    setBusy(true);
    try {
      setSimulated(await api("getAcademicConditions", { courseId, rulesOverride: sim }));
    } catch (err: any) {
      showToast("No se pudo simular: " + err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const close = async () => {
    const total = current?.summary.total || 0;
    if (!(await confirmAction({
      message: `¿Cerrar la cursada y congelar el acta de ${total} estudiantes? Después no se pueden cargar notas ni asistencia hasta reabrir.`,
      tone: "danger",
    }))) return;
    setBusy(true);
    try {
      const res = await api("closeCourse", { courseId, note: note || undefined });
      showToast(`Acta v${res.version} congelada (${res.students} estudiantes).`, "success");
      setNote("");
      await load();
    } catch (err: any) {
      showToast("No se pudo cerrar: " + err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const reopen = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("reopenCourse", { courseId, reason });
      showToast("Cursada reabierta. El acta anterior queda guardada.", "success");
      setReason("");
      await load();
    } catch (err: any) {
      showToast("No se pudo reabrir: " + err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const exportActa = async (version: number) => {
    try {
      const res = await api("exportActaCsv", { courseId, version });
      downloadCsv(res.filename, res.csv);
    } catch (err: any) {
      showToast("No se pudo exportar: " + err.message, "error");
    }
  };

  if (!status || !current) return <p className="text-xs text-gray-500" role="status">Cargando cierre de cursada…</p>;

  return (
    <div className="space-y-6">
      <section className="bg-neutral-900/60 p-5 rounded-2xl border border-neutral-800 space-y-3" aria-labelledby="closure-status">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 id="closure-status" className="font-bold text-sm text-white">Estado del acta</h4>
          <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${closed ? "bg-emerald-950/60 border-emerald-700/60 text-emerald-300" : "bg-neutral-800 border-neutral-700 text-gray-300"}`}>
            {closed ? `Cerrada · acta v${status.version}` : status.status === "reopened" ? `Reabierta (acta v${status.version} guardada)` : "Abierta"}
          </span>
        </div>
        {status.status === "reopened" && status.reopen_reason && (
          <p className="text-xs text-amber-300">Motivo de la reapertura: {status.reopen_reason}</p>
        )}

        {!closed ? (
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
            <div>
              <label htmlFor="closureNote" className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Nota para el acta (opcional)</label>
              <input id="closureNote" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} className={inputClass} placeholder="Ej: cierre del 1.er cuatrimestre" />
            </div>
            <button type="button" onClick={close} disabled={busy}
              className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50">
              🔒 Cerrar cursada y congelar acta
            </button>
          </div>
        ) : (
          <form onSubmit={reopen} className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
            <div>
              <label htmlFor="reopenReason" className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Motivo para reabrir</label>
              <input id="reopenReason" value={reason} onChange={(e) => setReason(e.target.value)} minLength={10} maxLength={1000} required className={inputClass}
                placeholder="Ej: corrección de la nota del P1 de un estudiante" />
            </div>
            <button type="submit" disabled={busy}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-gray-200 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50">
              Reabrir cursada
            </button>
          </form>
        )}

        {status.actas.length > 0 && (
          <ul className="space-y-2 text-xs">
            {status.actas.map((a) => (
              <li key={a.version} className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-neutral-800 bg-neutral-950">
                <span className="font-bold text-white">Acta v{a.version}</span>
                <span className="text-gray-400">{fmtDate(a.closed_at)} · {a.closed_by_name} · {a.students} estudiantes</span>
                <code className="text-[10px] text-gray-500" title={a.hash}>sha256 {a.hash.slice(0, 16)}…</code>
                <span className={a.intact ? "text-emerald-400" : "text-red-400 font-bold"}>{a.intact ? "✔ íntegra" : "✖ no coincide con su hash"}</span>
                <button type="button" onClick={() => exportActa(a.version)} disabled={!a.intact}
                  className="ml-auto px-3 py-1.5 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 rounded-lg font-semibold text-gray-300 cursor-pointer disabled:opacity-40">
                  ⬇️ CSV para SIU Guaraní
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-gray-500">
          El CSV usa <code>;</code> y coma decimal. Revisá las columnas contra la plantilla de importación de actas de SIU Guaraní antes de cargarlo.
        </p>
      </section>

      <section className="bg-neutral-900/60 p-5 rounded-2xl border border-neutral-800 space-y-3" aria-labelledby="edge-cases">
        <h4 id="edge-cases" className="font-bold text-sm text-white">Casos borde ({edgeCases.length})</h4>
        {edgeCases.length === 0 ? (
          <p className="text-xs text-gray-500">Nadie está a un paso de promocionar o regularizar.</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {edgeCases.map((r) => (
              <li key={r.student_id} className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-white">{r.full_name || r.email}</span>
                <ConditionChip condition={r.condition} />
                <span className="text-amber-400">{r.near_promotion ? "a 1 paso de promocionar" : "a 1 paso de regularizar"}</span>
                <span className="text-gray-500">{r.reasons[0]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-neutral-900/60 p-5 rounded-2xl border border-neutral-800 space-y-4" aria-labelledby="simulator">
        <div>
          <h4 id="simulator" className="font-bold text-sm text-white">Simulador de cierre</h4>
          <p className="text-[11px] text-gray-500">Probá reglas hipotéticas sobre el padrón actual. No guarda nada.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {SIM_FIELDS.map((f) => (
            <div key={f.key}>
              <label htmlFor={`sim-${f.key}`} className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{f.label}</label>
              {f.kind === "bool" ? (
                <select id={`sim-${f.key}`} value={sim[f.key] ? "1" : "0"} onChange={(e) => setSim({ ...sim, [f.key]: e.target.value === "1" })} className={inputClass}>
                  <option value="1">Sí</option>
                  <option value="0">No</option>
                </select>
              ) : (
                <input id={`sim-${f.key}`} type="number" min={0} max={f.kind === "percent" ? 100 : f.kind === "grade" ? 10 : 99} step={f.kind === "grade" ? 0.5 : 1}
                  value={f.kind === "percent" ? Math.round(Number(sim[f.key] ?? 0) * 100) : Number(sim[f.key] ?? 0)}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setSim({ ...sim, [f.key]: f.kind === "percent" ? n / 100 : n });
                  }}
                  className={inputClass} />
              )}
            </div>
          ))}
        </div>
        <button type="button" onClick={runSimulation} disabled={busy}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50">
          {busy ? "Simulando…" : "▶ Simular"}
        </button>

        {simulated && (
          <div className="space-y-3">
            <table className="text-xs w-full max-w-md">
              <thead className="text-[10px] text-gray-500 uppercase tracking-wider">
                <tr><th className="text-left py-1">Condición</th><th className="text-right">Actual</th><th className="text-right">Simulada</th></tr>
              </thead>
              <tbody>
                {CONDITIONS.map((c) => (
                  <tr key={c} className="border-t border-neutral-850">
                    <td className="py-1"><ConditionChip condition={c} /></td>
                    <td className="text-right text-gray-300">{current.summary.byCondition[c] || 0}</td>
                    <td className="text-right font-bold text-white">{simulated.summary.byCondition[c] || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h5 className="text-xs font-bold text-gray-300">Cambian de condición: {changes.length}</h5>
            <ul className="space-y-1 text-xs">
              {changes.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2">
                  <span className="text-white">{c.name}</span>
                  <ConditionChip condition={c.from} /> → <ConditionChip condition={c.to} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
