"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { showToast } from "@/components/dashboard/ui/ToastNotification";
import { useBeforeUnload } from "@/hooks/useBeforeUnload";
import type { GradingRules } from "./types";

type RuleKey = Exclude<keyof GradingRules, "required_tps">;
type PartialRules = Partial<Record<RuleKey, number | boolean>>;

interface Field {
  key: RuleKey;
  label: string;
  hint?: string;
  kind: "percent" | "grade" | "int" | "bool";
}

const FIELDS: Field[] = [
  { key: "min_attendance", label: "Asistencia mínima", kind: "percent" },
  { key: "min_classes_for_attendance", label: "Clases antes de evaluar asistencia", kind: "int" },
  { key: "partial_pass_grade", label: "Nota para aprobar parciales y TPs", kind: "grade" },
  { key: "promotion_grade", label: "Nota de promoción por parcial", kind: "grade" },
  { key: "promotion_ok_ratio", label: "TPs en OK para promocionar", kind: "percent" },
  { key: "max_late_for_promotion", label: "Máx. entregas fuera de término para promocionar", kind: "int" },
  { key: "max_exempt_tps", label: "TPs exceptuables por estudiante", kind: "int" },
  { key: "late_tolerance_hours", label: "Tolerancia después del vencimiento", hint: "horas corridas", kind: "int" },
  { key: "allow_promotion_via_recovery", label: "Permite promocionar rindiendo recuperatorio", kind: "bool" },
];

const inputClass = "w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white disabled:opacity-50";

/**
 * Reglas de regularidad y promoción: valores del curso y overrides por
 * comisión. Solo el titular las edita; los ayudantes las ven.
 */
export function GradingRulesForm({ courseId, onSaved }: { courseId: string; onSaved?: () => void }) {
  const [defaults, setDefaults] = useState<GradingRules | null>(null);
  const [courseRules, setCourseRules] = useState<PartialRules>({});
  const [overrides, setOverrides] = useState<Record<string, PartialRules>>({});
  const [commissions, setCommissions] = useState<string[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [scope, setScope] = useState("");
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);
  // Texto tal como se tipea ("7," antes de "7,5"); se descarta al salir del campo.
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const res = await api("getGradingRules", { courseId });
      setDefaults(res.defaults);
      setCourseRules(res.rules || {});
      setOverrides(res.commissionOverrides || {});
      setCommissions(res.commissions || []);
      setCanEdit(Boolean(res.canEdit));
      setSaved(JSON.stringify([res.rules || {}, res.commissionOverrides || {}]));
    } catch (err: any) {
      showToast("Error al cargar las reglas: " + err.message, "error");
    }
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

  const dirty = saved !== "" && saved !== JSON.stringify([courseRules, overrides]);
  useBeforeUnload(dirty);

  if (!defaults) return <p className="text-xs text-gray-500" role="status">Cargando reglas…</p>;

  const scoped = scope ? overrides[scope] || {} : courseRules;
  const inherited = (key: RuleKey) => (scope ? courseRules[key] ?? defaults[key] : defaults[key]);
  const valueOf = (key: RuleKey) => scoped[key] ?? inherited(key);

  const setValue = (key: RuleKey, value: number | boolean | undefined) => {
    const apply = (rules: PartialRules) => {
      const next = { ...rules };
      if (value === undefined) delete next[key];
      else next[key] = value;
      return next;
    };
    if (scope) setOverrides((prev) => ({ ...prev, [scope]: apply(prev[scope] || {}) }));
    else setCourseRules((prev) => apply(prev));
  };

  const display = (field: Field, value: number | boolean) => {
    if (field.kind === "percent") return String(Math.round(Number(value) * 100));
    return String(value);
  };

  const parse = (field: Field, raw: string): number | undefined => {
    if (raw.trim() === "") return undefined;
    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n)) return undefined;
    if (field.kind === "percent") return Math.min(100, Math.max(0, n)) / 100;
    if (field.kind === "grade") return Math.min(10, Math.max(0, n));
    return Math.max(0, Math.round(n));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const commissionOverrides = Object.fromEntries(Object.entries(overrides).filter(([, r]) => Object.keys(r).length > 0));
      await api("updateGradingRules", { courseId, rules: courseRules, commissionOverrides });
      setSaved(JSON.stringify([courseRules, overrides]));
      showToast("Reglas guardadas. La condición de los estudiantes se recalcula con estos valores.", "success");
      onSaved?.();
    } catch (err: any) {
      showToast("Error al guardar las reglas: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="bg-neutral-900/60 p-5 rounded-2xl border border-neutral-800 space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h4 className="font-bold text-sm text-white">Reglas de regularidad y promoción</h4>
          {!canEdit && <p className="text-[11px] text-gray-500">Solo el profesor titular puede modificarlas.</p>}
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-400">
          Aplicar a
          <select value={scope} onChange={(e) => setScope(e.target.value)} className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-gray-200">
            <option value="">Todo el curso</option>
            {commissions.map((c) => <option key={c} value={c}>{c}{overrides[c] && Object.keys(overrides[c]).length ? " (personalizada)" : ""}</option>)}
          </select>
        </label>
      </div>
      {scope && <p className="text-[11px] text-gray-500">Los campos vacíos heredan el valor del curso.</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FIELDS.map((field) => {
          const id = `rule-${field.key}`;
          const own = scoped[field.key] !== undefined;
          const draftKey = `${scope}:${field.key}`;
          if (field.kind === "bool") {
            return (
              <label key={field.key} htmlFor={id} className="flex items-center gap-2 text-xs text-gray-300 md:col-span-2 cursor-pointer">
                <input id={id} type="checkbox" disabled={!canEdit} checked={Boolean(valueOf(field.key))}
                  onChange={(e) => setValue(field.key, e.target.checked)} className="rounded bg-neutral-950 border-neutral-800" />
                {field.label}
                {scope && own && (
                  <button type="button" onClick={() => setValue(field.key, undefined)} className="text-[10px] text-blue-400 underline cursor-pointer">heredar</button>
                )}
              </label>
            );
          }
          return (
            <div key={field.key}>
              <label htmlFor={id} className="block text-[11px] font-semibold text-gray-400 mb-1">
                {field.label}{field.kind === "percent" ? " (%)" : ""}{field.hint ? ` (${field.hint})` : ""}
              </label>
              <input id={id} inputMode="decimal" disabled={!canEdit}
                value={drafts[draftKey] ?? (own ? display(field, scoped[field.key] as number) : "")}
                placeholder={display(field, inherited(field.key) as number)}
                onChange={(e) => {
                  const raw = e.target.value;
                  setDrafts((prev) => ({ ...prev, [draftKey]: raw }));
                  setValue(field.key, parse(field, raw));
                }}
                onBlur={() => setDrafts(({ [draftKey]: _, ...rest }) => rest)}
                className={inputClass} />
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-gray-500">
        Los TPs que cuentan para regularizar son los marcados como “Obligatorio” en la pestaña Tareas.
      </p>

      {canEdit && (
        <div className="flex justify-end">
          <button type="submit" disabled={saving || !dirty}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-40">
            {saving ? "Guardando…" : "Guardar reglas"}
          </button>
        </div>
      )}
    </form>
  );
}
