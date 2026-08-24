"use client";

import React, { useState } from "react";
import { api } from "@/lib/api";

interface DropoutRiskPanelProps {
  profile: any;
  selectedCourse: any;
  setApiLoading: (v: boolean) => void;
}

const LEVEL_STYLES: Record<string, string> = {
  ALTO: "bg-red-950/60 border-red-800/40 text-red-400",
  MEDIO: "bg-amber-950/60 border-amber-800/40 text-amber-400",
  BAJO: "bg-emerald-950/60 border-emerald-800/40 text-emerald-400"
};

/**
 * Early-dropout prediction board for teachers. Combines attendance,
 * assignment delivery timeliness and forum participation into a per-student
 * risk score computed server-side by `getDropoutRiskAnalysis`.
 */
export default function DropoutRiskPanel({ profile, selectedCourse, setApiLoading }: DropoutRiskPanelProps) {
  const [analysis, setAnalysis] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);

  if (profile?.role !== "teacher" && profile?.role !== "admin") return null;

  const runAnalysis = async () => {
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid) return;
    setIsRunning(true);
    try {
      const res = await api("getDropoutRiskAnalysis", { courseId: cid });
      setAnalysis(res);
    } finally {
      setIsRunning(false);
      setApiLoading(false);
    }
  };

  return (
    <div className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-base font-bold text-white">🔮 Predicción de Abandono (Analítica Temprana)</h3>
          <p className="text-xs text-gray-400 mt-1">
            Puntaje 0–100 combinando asistencia, entregas pendientes/tardías y participación en foros.
          </p>
        </div>
        <button
          type="button"
          onClick={runAnalysis}
          disabled={isRunning}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-lg"
        >
          {isRunning ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-t-transparent border-white rounded-full animate-spin"></span>
              <span>Analizando…</span>
            </>
          ) : (
            <span>{analysis ? "🔄 Recalcular Riesgo" : "🔮 Calcular Riesgo de Abandono"}</span>
          )}
        </button>
      </div>

      {analysis && (
        <div className="space-y-2 animate-in fade-in duration-200">
          <p className="text-[10px] text-gray-500">
            Generado {new Date(analysis.generated_at).toLocaleString("es-AR")} · {analysis.total_classes} clases · {analysis.total_assignments} tareas
          </p>
          <div className="overflow-x-auto rounded-xl border border-neutral-850">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-950/60 text-[10px] uppercase tracking-wider text-gray-500">
                  <th className="px-3 py-2">Riesgo</th>
                  <th className="px-3 py-2">Estudiante</th>
                  <th className="px-3 py-2">Puntaje</th>
                  <th className="px-3 py-2">Asistencia</th>
                  <th className="px-3 py-2">Entregas</th>
                  <th className="px-3 py-2">Tardías</th>
                  <th className="px-3 py-2">Foro</th>
                </tr>
              </thead>
              <tbody>
                {analysis.students.map((s: any) => (
                  <tr key={s.student_id} className="border-b border-neutral-900/70 last:border-0">
                    <td className="px-3 py-2">
                      <span className={`px-2.5 py-0.5 rounded-lg border text-[10px] font-bold ${LEVEL_STYLES[s.level] || ""}`}>
                        {s.level}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-200 font-semibold">{s.full_name}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center space-x-2 min-w-[110px]">
                        <span className="font-mono font-bold text-gray-100">{s.score}</span>
                        <div className="flex-1 h-1.5 bg-neutral-900 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${s.level === "ALTO" ? "bg-red-500" : s.level === "MEDIO" ? "bg-amber-500" : "bg-emerald-500"}`}
                            style={{ width: `${s.score}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-300 font-mono">{s.metrics.attendance_ratio}%</td>
                    <td className="px-3 py-2 text-gray-300 font-mono">{s.metrics.submitted}/{s.metrics.total_assignments}</td>
                    <td className="px-3 py-2 text-gray-300 font-mono">{s.metrics.late}</td>
                    <td className="px-3 py-2 text-gray-300 font-mono">{s.metrics.forum_comments}</td>
                  </tr>
                ))}
                {analysis.students.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-4 text-center text-gray-500 italic">
                      No hay estudiantes activos en el roster.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
