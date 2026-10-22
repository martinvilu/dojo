"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { copyToClipboard } from "@/lib/clipboard";
import { showToast } from "@/components/dashboard/ui/ToastNotification";
import { confirmAction } from "@/components/dashboard/ui/ConfirmDialog";

interface Platform {
  id: string;
  issuer: string;
  client_id: string;
  deployment_ids: string[];
  status: "pending" | "approved" | "disabled";
  registered_via: string;
}

interface LinkedContext {
  id: string;
  platform_id: string;
  context_title: string;
  nrps: boolean;
  ags: boolean;
}

const STATUS_LABEL: Record<Platform["status"], { text: string; className: string }> = {
  pending: { text: "Pendiente de aprobación", className: "bg-amber-950/60 border-amber-700/60 text-amber-300" },
  approved: { text: "Aprobada", className: "bg-emerald-950/60 border-emerald-700/60 text-emerald-300" },
  disabled: { text: "Deshabilitada", className: "bg-neutral-800 border-neutral-700 text-gray-400" },
};

const inputClass = "w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white";
const EMPTY_MANUAL = { issuer: "", clientId: "", deploymentId: "", authLoginUrl: "", authTokenUrl: "", jwksUrl: "" };

/**
 * Integración LTI 1.3 Advantage administrada por el titular: registro
 * dinámico (o manual), estado de aprobación y sincronización del padrón.
 */
export default function LtiAdvantagePanel({ courseId, canEdit }: { courseId: string; canEdit: boolean }) {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [contexts, setContexts] = useState<LinkedContext[]>([]);
  const [registrationUrl, setRegistrationUrl] = useState("");
  const [manual, setManual] = useState(EMPTY_MANUAL);
  const [busy, setBusy] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const load = useCallback(async () => {
    try {
      const res = await api("getLtiPlatforms", { courseId });
      setPlatforms(res.platforms || []);
      setContexts(res.contexts || []);
    } catch (err: any) {
      showToast("Error al cargar la integración LTI: " + err.message, "error");
    }
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    try {
      const { token } = await api("createLtiRegistrationToken", { courseId });
      setRegistrationUrl(`${origin}/api/v1/lti/register?rt=${token}`);
    } catch (err: any) {
      showToast("No se pudo generar la URL: " + err.message, "error");
    }
  };

  const handleManual = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api("registerLtiPlatform", { courseId, ...manual });
      setManual(EMPTY_MANUAL);
      await load();
      showToast("Plataforma registrada. Un administrador del Dojo tiene que aprobarla.", "success");
    } catch (err: any) {
      showToast("No se pudo registrar: " + err.message, "error");
    }
  };

  const handleUnlink = async (platform: Platform) => {
    if (!(await confirmAction({ message: `¿Desvincular ${platform.issuer} de esta cátedra? Los launches desde ese Moodle dejarán de entrar a este curso.`, tone: "danger" }))) return;
    try {
      await api("unlinkLtiPlatform", { courseId, platformId: platform.id });
      await load();
    } catch (err: any) {
      showToast("No se pudo desvincular: " + err.message, "error");
    }
  };

  const handleSyncRoster = async () => {
    setBusy(true);
    try {
      const r = await api("syncLtiRoster", { courseId });
      showToast(r.unchanged === r.contexts
        ? "El padrón de Moodle no cambió desde la última sincronización."
        : `Padrón sincronizado: ${r.added} altas, ${r.staff} docentes, ${r.removed} bajas.`, "success");
    } catch (err: any) {
      showToast("Error al sincronizar el padrón: " + err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const field = (key: keyof typeof EMPTY_MANUAL, label: string, placeholder: string) => (
    <div>
      <label htmlFor={`lti-${key}`} className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{label}</label>
      <input id={`lti-${key}`} value={manual[key]} onChange={(e) => setManual({ ...manual, [key]: e.target.value })} placeholder={placeholder} required className={inputClass} />
    </div>
  );

  return (
    <div className="bg-neutral-900/60 p-5 rounded-2xl border border-neutral-800 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-gray-200">🔗 Moodle LTI 1.3 Advantage</h3>
        <p className="text-xs text-gray-400 mt-1">
          Ingreso sin doble login desde Moodle, sincronización del padrón (NRPS) y publicación de notas (AGS).
          Guía paso a paso en el manual docente, sección “Moodle con LTI 1.3”.
        </p>
      </div>

      {platforms.length > 0 && (
        <ul className="space-y-2">
          {platforms.map((p) => (
            <li key={p.id} className="flex flex-wrap justify-between items-center gap-2 p-3 rounded-xl border border-neutral-800 bg-neutral-950 text-xs">
              <div>
                <p className="font-semibold text-white">{p.issuer}</p>
                <p className="text-gray-500 font-mono">client_id {p.client_id} · deployment {p.deployment_ids.join(", ") || "—"}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${STATUS_LABEL[p.status].className}`}>{STATUS_LABEL[p.status].text}</span>
                {canEdit && <button type="button" onClick={() => handleUnlink(p)} className="text-red-400 hover:text-red-300 underline cursor-pointer">Desvincular</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {platforms.some((p) => p.status === "pending") && (
        <p className="text-[11px] text-amber-300">
          Mientras la plataforma esté pendiente solo pueden ingresar estudiantes, con cuenta nueva e inscripción pendiente. Pedile a un administrador del Dojo que la apruebe.
        </p>
      )}

      {contexts.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
          <span>Cursos de Moodle vinculados: {contexts.map((c) => c.context_title).join(", ")}</span>
          <button type="button" onClick={handleSyncRoster} disabled={busy || !contexts.some((c) => c.nrps)}
            className="px-3 py-2 bg-neutral-950 border border-neutral-800 hover:bg-neutral-800 rounded-xl font-semibold text-gray-200 cursor-pointer disabled:opacity-40">
            {busy ? "Sincronizando…" : "👥 Sincronizar padrón (NRPS)"}
          </button>
        </div>
      )}

      {canEdit && (
        <>
          <div className="space-y-2">
            <button type="button" onClick={handleGenerate} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold cursor-pointer">
              Generar URL de registro dinámico
            </button>
            {registrationUrl && (
              <div className="flex items-center gap-2">
                <input readOnly value={registrationUrl} aria-label="URL de registro dinámico LTI" className={`${inputClass} font-mono text-amber-400 select-all`} />
                <button type="button" onClick={async () => showToast((await copyToClipboard(registrationUrl)) ? "URL copiada. Vence en 1 hora y sirve una sola vez." : "No se pudo copiar.", "success")}
                  className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-xs font-semibold text-gray-200 cursor-pointer">Copiar</button>
              </div>
            )}
            <p className="text-[11px] text-gray-500">En Moodle: Administración del sitio → Plugins → Herramienta externa → Gestionar herramientas → “URL de la herramienta” → Agregar LTI Advantage.</p>
          </div>

          <details>
            <summary className="text-xs font-semibold text-gray-300 cursor-pointer">Registro manual (si tu Moodle no ofrece registro dinámico)</summary>
            <div className="mt-3 text-[11px] text-gray-500 space-y-1">
              <p>Datos de la herramienta para cargar en Moodle:</p>
              <p className="font-mono">Login: {origin}/api/v1/lti/login_initiations · Redirección: {origin}/api/v1/lti/launch · JWKS: {origin}/api/v1/lti/jwks · Parámetro personalizado: courseId={courseId}</p>
            </div>
            <form onSubmit={handleManual} className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              {field("issuer", "ID de la plataforma (issuer)", "https://campus.unrn.edu.ar")}
              {field("clientId", "Client ID", "abc123")}
              {field("deploymentId", "Deployment ID", "1")}
              {field("authLoginUrl", "URL de autenticación", "https://…/mod/lti/auth.php")}
              {field("authTokenUrl", "URL del token", "https://…/mod/lti/token.php")}
              {field("jwksUrl", "URL del conjunto de claves", "https://…/mod/lti/certs.php")}
              <button type="submit" className="md:col-span-2 justify-self-start px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-gray-200 rounded-xl text-xs font-semibold cursor-pointer">Registrar plataforma</button>
            </form>
          </details>
        </>
      )}
    </div>
  );
}
