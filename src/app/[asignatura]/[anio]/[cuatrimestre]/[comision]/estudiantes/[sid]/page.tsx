"use client";

import { use } from "react";
import { SemanticDashboard } from "@/app/dashboard/components/SemanticDashboard";

type Params = { asignatura: string; anio: string; cuatrimestre: string; comision: string; sid: string };

/** Ficha del estudiante (alias `st_…`): condición, parciales y excepciones. */
export default function StudentRecordPage({ params }: { params: Promise<Params> }) {
  const { sid, ...p } = use(params);
  return <SemanticDashboard route={{ ...p, subTab: "academic", studentPublicId: sid }} />;
}
