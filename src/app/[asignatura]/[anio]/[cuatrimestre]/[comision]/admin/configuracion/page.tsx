"use client";

import { use } from "react";
import { SemanticDashboard } from "@/app/dashboard/components/SemanticDashboard";

type Params = { asignatura: string; anio: string; cuatrimestre: string; comision: string };

/** Reglas, integraciones y ajustes de la cátedra. */
export default function CourseSettingsPage({ params }: { params: Promise<Params> }) {
  const p = use(params);
  return <SemanticDashboard route={{ ...p, subTab: "settings" }} />;
}
