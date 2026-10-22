import type { AcademicCondition, CriterionStatus } from "./types";

const CONDITION_STYLES: Record<AcademicCondition, string> = {
  Promocionado: "bg-emerald-950/60 border-emerald-700/60 text-emerald-300",
  Regular: "bg-blue-950/60 border-blue-700/60 text-blue-300",
  Condicional: "bg-neutral-800 border-neutral-700 text-gray-300",
  "EN RIESGO": "bg-red-950/60 border-red-700/60 text-red-300",
  Ausente: "bg-amber-950/60 border-amber-700/60 text-amber-300",
  Baja: "bg-neutral-900 border-neutral-800 text-gray-500",
};

/** Chip `rounded-full` de condición académica (SPEC §4.2). */
export function ConditionChip({ condition }: { condition: AcademicCondition }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${CONDITION_STYLES[condition] || CONDITION_STYLES.Condicional}`}>
      {condition}
    </span>
  );
}

const STATUS_META: Record<CriterionStatus, { icon: string; label: string; className: string }> = {
  ok: { icon: "✓", label: "Cumplido", className: "text-emerald-400" },
  pending: { icon: "…", label: "Pendiente", className: "text-gray-400" },
  failed: { icon: "✕", label: "Incumplido", className: "text-red-400" },
  na: { icon: "–", label: "No aplica", className: "text-gray-600" },
};

export function CriterionStatusIcon({ status }: { status: CriterionStatus }) {
  const meta = STATUS_META[status] || STATUS_META.pending;
  return (
    <span className={`font-bold ${meta.className}`} title={meta.label} aria-label={meta.label}>
      {meta.icon}
    </span>
  );
}

export const percent = (ratio: number | null | undefined) =>
  ratio === null || ratio === undefined ? "—" : `${Math.round(ratio * 100)}%`;
