"use client";

import { use } from "react";
import { SemanticDashboard } from "@/app/dashboard/components/SemanticDashboard";

type Params = { asignatura: string; anio: string; cuatrimestre: string; comision: string };

/** /{asignatura}/{anio}/{cuatrimestre}/{comision}: resumen de la comisión. */
export default function CommissionPage({ params }: { params: Promise<Params> }) {
  const p = use(params);
  return <SemanticDashboard route={{ ...p, subTab: "overview" }} />;
}
