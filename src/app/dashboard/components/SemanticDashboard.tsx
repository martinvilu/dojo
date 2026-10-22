"use client";

import DashboardPage from "@/app/dashboard/page";
import { DeepLinkProvider, type SemanticRoute } from "../deepLinkContext";

/**
 * Dashboard abierto desde una URL semántica: los segmentos se traducen a
 * IDs internos con `resolveCourseRoute` recién después de autenticar, así
 * ningún uid viaja en el HTML.
 */
export function SemanticDashboard({ route }: { route: SemanticRoute }) {
  return (
    <DeepLinkProvider route={route}>
      <DashboardPage />
    </DeepLinkProvider>
  );
}
