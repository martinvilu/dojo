/** Contratos de las acciones de cursada (functions/src/modules/course/academic.js y afines). */

export type AcademicCondition = "Promocionado" | "Regular" | "Condicional" | "EN RIESGO" | "Ausente" | "Baja";
export type CriterionStatus = "ok" | "pending" | "failed" | "na";

export interface GradingRules {
  min_attendance: number;
  min_classes_for_attendance: number;
  required_tps: "all" | string[];
  max_exempt_tps: number;
  partial_pass_grade: number;
  promotion_grade: number;
  promotion_ok_ratio: number;
  max_late_for_promotion: number;
  allow_promotion_via_recovery: boolean;
  late_tolerance_hours: number;
  consecutive_absences_alert: number;
  no_repo_alert_days: number;
  silent_dropout_days: number;
}

export interface PartialResult {
  id: string;
  label: string;
  original: number | null;
  absent: boolean;
  recoveries: { id: string; label: string; value: number | null; absent: boolean }[];
  best: number | null;
  regularity: CriterionStatus;
  promotion: CriterionStatus;
}

export interface ConditionResult {
  student_id: string;
  full_name?: string;
  email?: string;
  matricula_unrn?: string;
  commission: string | null;
  condition: AcademicCondition;
  provisional: boolean;
  regularity: { attendance: CriterionStatus; tps: CriterionStatus; partials: CriterionStatus };
  promotion: { ok_ratio: CriterionStatus; late: CriterionStatus; partials: CriterionStatus };
  attendance: { status: CriterionStatus; ratio: number | null; attended: number; held: number; justified: number; waived: boolean; required: number };
  tps: {
    status: CriterionStatus;
    required: number;
    delivered: number;
    missing: string[];
    exempt: string[];
    ok_ratio: { status: CriterionStatus; ratio: number | null; approved: number; needed: number };
    late: { status: CriterionStatus; count: number; max: number };
    items: { id: string; title: string; required: boolean; exempt: boolean; state: string; late: boolean }[];
  };
  partials: PartialResult[];
  reasons: string[];
  near_promotion: boolean;
  near_regularity: boolean;
  rules?: GradingRules;
  /** Condición congelada en el acta, cuando la cursada está cerrada. */
  final?: { version: number; condition: AcademicCondition; siu_condition: string; final_grade: number | null };
}

export interface ConditionsResponse {
  generatedAt: string;
  simulated: boolean;
  rules: GradingRules;
  summary: { total: number; byCondition: Record<AcademicCondition, number>; nearPromotion: number; nearRegularity: number };
  results: ConditionResult[];
}

export interface Assessment {
  id: string;
  kind: "parcial" | "recuperatorio";
  label: string;
  recovers: string | null;
  date: string | null;
  commission: string | null;
}

export interface AssessmentGrade {
  id: string;
  assessment_id: string;
  student_id: string;
  grade: string;
  absent: boolean;
  feedback: string;
}

export type ExceptionType = "attendance_waiver" | "tp_exempt" | "deadline_extension";

export interface CourseException {
  id: string;
  student_id: string;
  type: ExceptionType;
  assignment_id: string | null;
  extra_hours: number | null;
  reason: string;
  granted_by_name: string;
  revoked: boolean;
  revoke_reason: string;
}

export interface RosterStudent {
  id: string;
  full_name?: string;
  email?: string;
  matricula_unrn?: string;
  commissions?: Record<string, string>;
  role?: string;
}

export interface CourseAssignment {
  id: string;
  title: string;
  due_date?: string;
  is_required?: boolean;
}

export const EXCEPTION_LABELS: Record<ExceptionType, string> = {
  attendance_waiver: "Eximición de asistencia",
  tp_exempt: "TP exceptuado",
  deadline_extension: "Prórroga de entrega",
};
