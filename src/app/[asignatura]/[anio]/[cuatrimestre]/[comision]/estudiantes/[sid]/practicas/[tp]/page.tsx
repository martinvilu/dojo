"use client";

import { use } from "react";
import { SemanticDashboard } from "@/app/dashboard/components/SemanticDashboard";

type Params = { asignatura: string; anio: string; cuatrimestre: string; comision: string; sid: string; tp: string };

/** Práctica del estudiante: entrega, commits y Pull Requests. */
export default function StudentPracticePage({ params }: { params: Promise<Params> }) {
  const { sid, tp, ...p } = use(params);
  return <SemanticDashboard route={{ ...p, subTab: "assignments", studentPublicId: sid, practica: tp }} />;
}
