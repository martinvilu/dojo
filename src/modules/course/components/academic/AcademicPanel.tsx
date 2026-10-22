"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { showToast } from "@/components/dashboard/ui/ToastNotification";
import { ConditionChip } from "./ConditionChip";
import { ConditionDetail } from "./ConditionDetail";
import { ConditionsTable } from "./ConditionsTable";
import { AssessmentsManager } from "./AssessmentsManager";
import { ExceptionsManager } from "./ExceptionsManager";
import { GradingRulesForm } from "./GradingRulesForm";
import { ReviewRequests } from "./ReviewRequests";
import { ClosurePanel } from "./ClosurePanel";
import { EXCEPTION_LABELS, type ConditionResult, type CourseAssignment, type CourseException, type RosterStudent } from "./types";

type StaffTab = "conditions" | "assessments" | "exceptions" | "reviews" | "rules" | "closure";

const STAFF_TABS: { id: StaffTab; label: string }[] = [
  { id: "conditions", label: "Condición" },
  { id: "assessments", label: "Parciales" },
  { id: "exceptions", label: "Excepciones" },
  { id: "reviews", label: "Consultas" },
  { id: "rules", label: "Reglas" },
  { id: "closure", label: "Cierre" },
];

/** Vista de la cátedra: condición del padrón, parciales, excepciones y reglas. */
function StaffAcademicView({ courseId, commissions }: { courseId: string; commissions: string[] }) {
  const [tab, setTab] = useState<StaffTab>("conditions");
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [assignments, setAssignments] = useState<CourseAssignment[]>([]);
  // Cambiar reglas, notas o excepciones invalida la tabla de condiciones.
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api("getCourseRoster", { courseId }),
      api("getTeacherAssignments", { courseIds: [courseId] }),
    ]).then(([r, a]) => {
      if (cancelled) return;
      setRoster(r || []);
      setAssignments((a || []).filter((x: any) => x.course_id === courseId && !x.is_archived));
    }).catch((err) => showToast("Error al cargar el padrón: " + err.message, "error"));
    return () => { cancelled = true; };
  }, [courseId]);

  const switchTab = (next: StaffTab) => {
    if (next === "conditions") setRevision((n) => n + 1);
    setTab(next);
  };

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Secciones de cursada" className="flex bg-neutral-900 border border-neutral-800 rounded-xl p-1 text-xs font-medium w-fit flex-wrap gap-1">
        {STAFF_TABS.map((t) => (
          <button key={t.id} role="tab" type="button" aria-selected={tab === t.id} onClick={() => switchTab(t.id)}
            className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${tab === t.id ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === "conditions" && <ConditionsTable key={revision} courseId={courseId} commissions={commissions} />}
        {tab === "assessments" && <AssessmentsManager courseId={courseId} roster={roster} commissions={commissions} />}
        {tab === "exceptions" && <ExceptionsManager courseId={courseId} roster={roster} assignments={assignments} />}
        {tab === "reviews" && <ReviewRequests courseId={courseId} mode="staff" />}
        {tab === "rules" && <GradingRulesForm courseId={courseId} />}
        {tab === "closure" && <ClosurePanel courseId={courseId} />}
      </div>
    </div>
  );
}

/** Vista del estudiante: su condición provisional, el detalle y sus excepciones. */
function StudentAcademicView({ courseId }: { courseId: string }) {
  const [result, setResult] = useState<ConditionResult | null>(null);
  const [exceptions, setExceptions] = useState<CourseException[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [condition, own] = await Promise.all([
        api("getMyAcademicCondition", { courseId }),
        api("getExceptions", { courseId }),
      ]);
      setResult(condition);
      setExceptions((own || []).filter((e: CourseException) => !e.revoked));
    } catch (err: any) {
      setError(err.message);
    }
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

  if (error) return <p className="text-xs text-red-400" role="alert">No pudimos calcular tu condición: {error}</p>;
  if (!result) return <p className="text-xs text-gray-500" role="status">Calculando tu condición…</p>;

  return (
    <div className="bg-neutral-900/60 p-5 rounded-2xl border border-neutral-800 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="font-bold text-sm text-white">Tu condición en la cursada</h4>
          <p className="text-[11px] text-gray-500">
            {result.final
              ? `Final: la cátedra cerró el acta (v${result.final.version}).`
              : "Provisional: se calcula con tus asistencias, entregas y notas cargadas hasta hoy."}
          </p>
        </div>
        <ConditionChip condition={result.final ? result.final.condition : result.condition} />
      </div>
      {result.final && (
        <p className="text-xs text-gray-300">
          En el acta figurás como <strong>{result.final.siu_condition}</strong>
          {result.final.final_grade !== null ? ` con nota ${String(result.final.final_grade).replace(".", ",")}` : ""}.
        </p>
      )}
      {result.near_promotion && <p className="text-xs text-amber-300">Estás a un paso de promocionar. Revisá los motivos de abajo.</p>}
      <ConditionDetail result={result} />
      <section className="border-t border-neutral-800 pt-4 space-y-2">
        <h5 className="text-xs font-bold text-gray-300">¿Algo de tu ficha no cuadra? Consultá a la cátedra</h5>
        <ReviewRequests courseId={courseId} mode="student" condition={result} />
      </section>
      {exceptions.length > 0 && (
        <div className="text-xs">
          <h6 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Excepciones otorgadas por la cátedra</h6>
          <ul className="space-y-1 text-gray-300">
            {exceptions.map((e) => (
              <li key={e.id}>{EXCEPTION_LABELS[e.type]}{e.extra_hours ? ` (+${e.extra_hours} h)` : ""}: {e.reason}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function AcademicPanel({ courseId, profile, commissions }: {
  courseId: string;
  profile: any;
  commissions: string[];
}) {
  const isStaff = profile?.role === "teacher" || profile?.role === "admin";
  return isStaff
    ? <StaffAcademicView courseId={courseId} commissions={commissions} />
    : <StudentAcademicView courseId={courseId} />;
}
