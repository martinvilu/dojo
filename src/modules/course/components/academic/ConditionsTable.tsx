"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { showToast } from "@/components/dashboard/ui/ToastNotification";
import type { AcademicCondition, ConditionsResponse } from "./types";
import { ConditionChip, percent } from "./ConditionChip";
import { ConditionDetail } from "./ConditionDetail";

const CONDITION_ORDER: AcademicCondition[] = ["EN RIESGO", "Ausente", "Condicional", "Regular", "Promocionado", "Baja"];

/** Condición provisional de todo el padrón, filtrable por comisión y condición. */
export function ConditionsTable({ courseId, commissions }: { courseId: string; commissions: string[] }) {
  const [data, setData] = useState<ConditionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [commission, setCommission] = useState("Todas");
  const [condition, setCondition] = useState<"Todas" | AcademicCondition | "edge">("Todas");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api("getAcademicConditions", { courseId }));
    } catch (err: any) {
      showToast("Error al calcular condiciones: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.results || []).filter((r) => {
      if (commission !== "Todas" && (r.commission || "Sin Comisión") !== commission) return false;
      if (condition === "edge" && !r.near_promotion && !r.near_regularity) return false;
      if (condition !== "Todas" && condition !== "edge" && r.condition !== condition) return false;
      if (!term) return true;
      return [r.full_name, r.email, r.matricula_unrn].some((v) => (v || "").toLowerCase().includes(term));
    });
  }, [data, commission, condition, search]);

  return (
    <div className="space-y-4">
      {data && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por condición">
          {CONDITION_ORDER.filter((c) => data.summary.byCondition[c]).map((c) => (
            <button key={c} type="button" onClick={() => setCondition(condition === c ? "Todas" : c)}
              aria-pressed={condition === c}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs cursor-pointer ${condition === c ? "border-blue-500 bg-neutral-900" : "border-neutral-800 bg-neutral-950 hover:bg-neutral-900"}`}>
              <ConditionChip condition={c} />
              <span className="font-bold text-white">{data.summary.byCondition[c]}</span>
            </button>
          ))}
          {(data.summary.nearPromotion + data.summary.nearRegularity) > 0 && (
            <button type="button" onClick={() => setCondition(condition === "edge" ? "Todas" : "edge")}
              aria-pressed={condition === "edge"}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer ${condition === "edge" ? "border-amber-500 bg-neutral-900 text-amber-300" : "border-neutral-800 bg-neutral-950 text-amber-400 hover:bg-neutral-900"}`}>
              ⚖️ Casos borde: {data.summary.nearPromotion + data.summary.nearRegularity}
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, email o matrícula"
          aria-label="Buscar estudiante" className="flex-1 min-w-[200px] bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white" />
        <select value={commission} onChange={(e) => setCommission(e.target.value)} aria-label="Comisión"
          className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-gray-300">
          <option value="Todas">Todas las comisiones</option>
          {commissions.map((c) => <option key={c} value={c}>{c}</option>)}
          <option value="Sin Comisión">Sin comisión</option>
        </select>
        <button type="button" onClick={load} disabled={loading}
          className="px-3 py-2 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 rounded-xl text-xs font-semibold text-gray-300 cursor-pointer disabled:opacity-50">
          {loading ? "Calculando…" : "🔄 Recalcular"}
        </button>
      </div>

      <p className="text-[11px] text-gray-500">
        Condición provisional con los datos actuales{data ? ` (calculada ${new Date(data.generatedAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })})` : ""}.
        Se congela recién en el cierre de cursada.
      </p>

      <div className="overflow-x-auto border border-neutral-800 rounded-2xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-neutral-950 text-[10px] text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-3 py-2 font-bold">Estudiante</th>
              <th className="px-3 py-2 font-bold">Comisión</th>
              <th className="px-3 py-2 font-bold">Asistencia</th>
              <th className="px-3 py-2 font-bold">TPs</th>
              <th className="px-3 py-2 font-bold">Condición</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Fragment key={r.student_id}>
                <tr className="border-t border-neutral-850 hover:bg-neutral-900/50">
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => setExpanded(expanded === r.student_id ? null : r.student_id)}
                      aria-expanded={expanded === r.student_id} className="text-left cursor-pointer">
                      <span className="font-semibold text-white hover:underline">{r.full_name || r.email || r.student_id}</span>
                      <span className="block text-[10px] text-gray-500 font-mono">{r.matricula_unrn || "Sin matrícula"}</span>
                    </button>
                  </td>
                  <td className="px-3 py-2 text-gray-400">{r.commission || "—"}</td>
                  <td className="px-3 py-2 text-gray-300">{percent(r.attendance.ratio)}</td>
                  <td className="px-3 py-2 text-gray-300">{r.tps.delivered}/{r.tps.required}{r.tps.late.count > 0 && <span className="text-amber-400"> · {r.tps.late.count} tarde</span>}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <ConditionChip condition={r.condition} />
                      {r.near_promotion && <span className="text-[10px] text-amber-400 font-semibold">a 1 paso de promocionar</span>}
                      {r.near_regularity && <span className="text-[10px] text-amber-400 font-semibold">a 1 paso de regularizar</span>}
                    </div>
                  </td>
                </tr>
                {expanded === r.student_id && (
                  <tr className="bg-neutral-950/70">
                    <td colSpan={5} className="px-4 py-4"><ConditionDetail result={r} /></td>
                  </tr>
                )}
              </Fragment>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-500">No hay estudiantes que coincidan con el filtro.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
