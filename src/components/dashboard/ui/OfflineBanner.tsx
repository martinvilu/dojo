"use client";

import { useEffect, useRef, useState } from "react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

const RECONNECTED_MESSAGE_MS = 4000;

/**
 * Top banner shown while the browser is offline (mejora 1.33), so users in
 * the classroom know why saves and realtime updates stopped instead of
 * seeing silent Firestore failures. Announces the change through a polite
 * live region and briefly confirms when the connection comes back.
 */
export default function OfflineBanner() {
  const online = useOnlineStatus();
  const wasOffline = useRef(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      return;
    }
    if (!wasOffline.current) return;
    wasOffline.current = false;
    const show = setTimeout(() => setShowReconnected(true), 0);
    const hide = setTimeout(() => setShowReconnected(false), RECONNECTED_MESSAGE_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [online]);

  const visible = !online || showReconnected;

  return (
    <div role="status" aria-live="polite" className="contents">
      {visible && (
        <div
          className={`fixed top-0 inset-x-0 z-[1000001] px-4 py-2 text-center text-xs font-semibold shadow-lg ${
            online ? "bg-emerald-700 text-white" : "bg-error text-on-error"
          }`}
        >
          {online
            ? "Conexión restablecida. Los cambios vuelven a sincronizarse."
            : "Sin conexión a Internet. Los cambios no se guardarán hasta que vuelvas a conectarte."}
        </div>
      )}
    </div>
  );
}
