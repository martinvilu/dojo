"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { SemanticDashboard } from "@/app/dashboard/components/SemanticDashboard";
import { VIEW_TO_SUBTAB } from "@/lib/courseRoutes";

type Params = { asignatura: string; anio: string; cuatrimestre: string; comision: string; vista: string };

/** /…/{comision}/planilla, /cronograma, /tareas, /cursada, … */
export default function CommissionViewPage({ params }: { params: Promise<Params> }) {
  const { vista, ...p } = use(params);
  const subTab = (VIEW_TO_SUBTAB as Record<string, string>)[vista];
  if (!subTab) notFound();
  return <SemanticDashboard route={{ ...p, subTab }} />;
}
