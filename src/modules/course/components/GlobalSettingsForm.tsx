"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { showToast } from "@/components/dashboard/ui/ToastNotification";

/**
 * Configuración global del sistema (solo admin). Carga y guarda por su
 * cuenta para no pasar el estado por todo el dashboard.
 */
export default function GlobalSettingsForm() {
  const [calendarUrl, setCalendarUrl] = useState("");
  const [domains, setDomains] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api("getGlobalSettings")
      .then((res) => {
        setCalendarUrl(res?.globalCalendarIcsUrl || "");
        setDomains((res?.allowed_email_domains || []).join(", "));
      })
      .catch((err) => showToast("No se pudo cargar la configuración: " + err.message, "error"))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api("saveGlobalSettings", { globalCalendarIcsUrl: calendarUrl, allowed_email_domains: domains });
      setDomains((res?.allowed_email_domains || []).join(", "));
      showToast("Configuración guardada.", "success");
    } catch (err: any) {
      showToast("No se pudo guardar la configuración: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} aria-busy={loading} className="bg-bg-secondary p-6 rounded-2xl border border-border-custom space-y-5 max-w-xl">
      <div>
        <label htmlFor="globalCalendarUrl" className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
          URL de Calendario Global (.ics)
        </label>
        <input
          id="globalCalendarUrl"
          type="url"
          value={calendarUrl}
          onChange={(e) => setCalendarUrl(e.target.value)}
          placeholder="https://example.com/calendar.ics"
          className="w-full bg-bg-primary border border-border-custom rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-text-primary"
        />
      </div>
      <div>
        <label htmlFor="allowedDomains" className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
          Dominios de correo habilitados
        </label>
        <input
          id="allowedDomains"
          type="text"
          value={domains}
          onChange={(e) => setDomains(e.target.value)}
          placeholder="unrn.edu.ar, alumnos.unrn.edu.ar"
          aria-describedby="allowedDomainsHelp"
          className="w-full bg-bg-primary border border-border-custom rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-text-primary"
        />
        <p id="allowedDomainsHelp" className="mt-1.5 text-[11px] text-text-secondary">
          Separados por coma. Incluye subdominios. Las cuentas nuevas de otros dominios quedan pendientes y no pueden autoaprobarse con la matrícula: las aprobás vos en Usuarios. Vacío = sin restricción.
        </p>
      </div>
      <button
        type="submit"
        disabled={saving || loading}
        className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition cursor-pointer disabled:opacity-50"
      >
        {saving ? "Guardando…" : "Guardar Configuración"}
      </button>
    </form>
  );
}
