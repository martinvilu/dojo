"use client";

import { use } from "react";
import { SemanticDashboard } from "@/app/dashboard/components/SemanticDashboard";

type Params = { asignatura: string; anio: string; cuatrimestre: string; comision: string; sid: string };

/** Asistencias y excepciones del estudiante (detalle en la pestaña Cursada). */
export default function StudentAttendancePage({ params }: { params: Promise<Params> }) {
  const { sid, ...p } = use(params);
  return <SemanticDashboard route={{ ...p, subTab: "academic", studentPublicId: sid }} />;
}
