"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { showToast } from "@/components/dashboard/ui/ToastNotification";
import { confirmAction } from "@/components/dashboard/ui/ConfirmDialog";

interface Platform {
  id: string;
  issuer: string;
  client_id: string;
  deployment_ids: string[];
  status: "pending" | "approved" | "disabled";
  registered_via: string;
  course_ids: string[];
}

/**
 * Revisión de plataformas LTI registradas por los titulares. Aprobar una
 * plataforma habilita launches docentes y el vínculo con cuentas existentes
 * por email o matrícula, así que solo lo decide un administrador.
 */
export default function AdminLtiPlatforms() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);

  const load = useCallback(async () => {
    try {
      setPlatforms(await api("getLtiPlatformsForReview") || []);
    } catch (err: any) {
      showToast("Error al cargar plataformas LTI: " + err.message, "error");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (platform: Platform, status: Platform["status"]) => {
    const message = status === "approved"
      ? `¿Aprobar ${platform.issuer}? Sus docentes podrán ingresar y los launches se vincularán con cuentas existentes del Dojo por email o matrícula.`
      : `¿${status === "disabled" ? "Deshabilitar" : "Volver a pendiente"} ${platform.issuer}?`;
    if (!(await confirmAction({ message, tone: status === "approved" ? "default" : "danger" }))) return;
    try {
      await api("setLtiPlatformStatus", { platformId: platform.id, status });
      await load();
    } catch (err: any) {
      showToast("No se pudo actualizar: " + err.message, "error");
    }
  };

  return (
    <section className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 space-y-4">
      <div>
        <h3 className="text-lg font-bold">Plataformas LTI 1.3</h3>
        <p className="text-xs text-gray-400">Registradas por los titulares desde Ajustes Cátedra. Verificá que el emisor sea el campus institucional antes de aprobar.</p>
      </div>
      {platforms.length === 0 && <p className="text-xs text-gray-500">No hay plataformas registradas.</p>}
      <ul className="space-y-2">
        {platforms.map((p) => (
          <li key={p.id} className="flex flex-wrap justify-between items-center gap-3 p-3 rounded-xl border border-neutral-800 bg-neutral-950 text-xs">
            <div>
              <p className="font-semibold text-white">{p.issuer}</p>
              <p className="text-gray-500 font-mono">client_id {p.client_id} · deployments {p.deployment_ids.join(", ") || "—"} · {p.course_ids.length} cátedra(s) · {p.registered_via}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 font-semibold">{p.status === "approved" ? "Aprobada" : p.status === "disabled" ? "Deshabilitada" : "Pendiente"}</span>
              {p.status !== "approved" && <button type="button" onClick={() => setStatus(p, "approved")} className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 rounded-lg font-semibold cursor-pointer">Aprobar</button>}
              {p.status !== "disabled" && <button type="button" onClick={() => setStatus(p, "disabled")} className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg font-semibold cursor-pointer">Deshabilitar</button>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
