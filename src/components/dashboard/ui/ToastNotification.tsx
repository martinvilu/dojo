"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface ToastNotificationProps {
  message: string;
  type: "success" | "error" | "info";
  onClose: () => void;
}

export default function ToastNotification({ message, type, onClose }: ToastNotificationProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === "undefined") return null;

  const content = (
    <div
      role="alert"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-[99999] flex items-center space-x-3 bg-bg-secondary border border-border-custom px-4 py-3.5 rounded-lg shadow-2xl max-w-[calc(100vw-3rem)] sm:max-w-md w-auto text-left pointer-events-auto transition-all"
    >
      <span
        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
          type === "success"
            ? "bg-emerald-500 shadow-md shadow-emerald-500/50"
            : type === "error"
            ? "bg-red-500 shadow-md shadow-red-500/50"
            : "bg-tertiary shadow-md shadow-tertiary/50"
        }`}
      ></span>
      <p className="text-xs text-text-primary font-medium leading-normal break-words flex-1">
        {message}
      </p>
      <button
        aria-label="Cerrar notificación"
        type="button"
        onClick={onClose}
        className="text-text-secondary hover:text-text-primary text-xs font-bold pl-2 cursor-pointer transition-colors shrink-0"
      >
        ✕
      </button>
    </div>
  );

  return createPortal(content, document.body);
}
