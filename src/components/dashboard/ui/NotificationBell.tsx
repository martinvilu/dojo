"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface StudentNotification {
  id: string;
  message: string;
  link?: string | null;
  read?: boolean;
  type?: string;
  created_at?: string | null;
}

const POLL_MS = 2 * 60 * 1000;

function timeAgo(iso?: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return new Date(iso).toLocaleDateString("es-AR");
}

/**
 * Campana de notificaciones del estudiante: correcciones, soluciones en el
 * foro, alertas y avisos generados por el backend. Consulta cada 2 minutos
 * solo mientras la pestaña está visible.
 */
export default function NotificationBell({ compact = false }: { compact?: boolean }) {
  const [items, setItems] = useState<StudentNotification[]>([]);
  const [open, setOpen] = useState(false);
  const unread = items.filter((n) => !n.read).length;

  const load = useCallback(async () => {
    try {
      const res = await api("getStudentNotifications");
      setItems(Array.isArray(res) ? res : []);
    } catch {
      // Sin notificaciones si el backend no responde: no bloquea el panel.
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const panelRef = useFocusTrap<HTMLDivElement>(open, { onEscape: () => setOpen(false) });

  const markAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await api("markNotificationsRead");
    } catch {
      load();
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread ? `Notificaciones: ${unread} sin leer` : "Notificaciones"}
        className="relative p-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
      >
        <span aria-hidden="true">🔔</span>
        {unread > 0 && (
          <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notificaciones"
          tabIndex={-1}
          className={`absolute z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-bg-secondary border border-border-custom rounded-2xl shadow-2xl ${compact ? "left-0" : "right-0"}`}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-custom">
            <h2 className="text-sm font-bold text-text-primary">Notificaciones</h2>
            {unread > 0 && (
              <button type="button" onClick={markAllRead} className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 cursor-pointer">
                Marcar todas como leídas
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto divide-y divide-border-custom">
            {items.length === 0 && (
              <li className="px-4 py-8 text-center text-xs text-text-secondary">No tenés notificaciones.</li>
            )}
            {items.map((n) => {
              const content = (
                <>
                  <p className={`text-xs ${n.read ? "text-text-secondary" : "text-text-primary font-semibold"}`}>{n.message}</p>
                  <p className="text-[10px] text-text-secondary mt-1">{timeAgo(n.created_at)}</p>
                </>
              );
              return (
                <li key={n.id} className={n.read ? "" : "bg-blue-500/5"}>
                  {n.link && n.link.startsWith("/dashboard") ? (
                    <a href={n.link} className="block px-4 py-3 hover:bg-bg-tertiary focus-visible:outline-2 focus-visible:outline-blue-500">{content}</a>
                  ) : (
                    <div className="px-4 py-3">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
