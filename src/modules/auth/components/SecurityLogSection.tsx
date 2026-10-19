"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { describeProvider, describeUserAgent } from "@/lib/userAgent";

interface SecurityLogEntry {
  id: string;
  auth_time: string | null;
  provider: string | null;
  ip: string | null;
  user_agent: string | null;
}

/**
 * Últimos inicios de sesión de la cuenta (mejora 3.44), para que cada
 * usuario detecte accesos que no reconoce.
 */
export default function SecurityLogSection() {
  const [entries, setEntries] = useState<SecurityLogEntry[] | null>(null);

  useEffect(() => {
    api("getSecurityLog")
      .then((res) => setEntries(Array.isArray(res) ? res : []))
      .catch(() => setEntries([]));
  }, []);

  return (
    <section aria-labelledby="security-log-title" className="space-y-3">
      <h3 id="security-log-title" className="text-sm font-bold text-text-primary uppercase tracking-wider border-b border-border-custom pb-2">
        🔐 Actividad de inicio de sesión
      </h3>
      <p className="text-xs text-text-secondary">
        Tus últimos ingresos. Si ves uno que no reconocés, cambiá tu contraseña y avisá a la coordinación.
      </p>
      {entries === null ? (
        <p className="text-xs text-text-secondary italic">Cargando…</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-text-secondary italic">Todavía no hay inicios de sesión registrados.</p>
      ) : (
        <ul className="divide-y divide-border-custom border border-border-custom rounded-xl overflow-hidden">
          {entries.map((e, i) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs">
              <div>
                <p className="font-semibold text-text-primary">
                  {describeUserAgent(e.user_agent)}
                  {i === 0 && <span className="ml-2 text-[10px] text-emerald-400 font-bold">Sesión actual</span>}
                </p>
                <p className="text-text-secondary">Con {describeProvider(e.provider)}{e.ip ? ` · IP ${e.ip}` : ""}</p>
              </div>
              <time dateTime={e.auth_time || undefined} className="text-text-secondary">
                {e.auth_time ? new Date(e.auth_time).toLocaleString("es-AR") : ""}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
