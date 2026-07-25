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
      className="fixed top-4 left-4 right-4 sm:left-auto sm:right-6 sm:top-6 z-[999999] flex items-center space-x-3 bg-neutral-900 border border-neutral-700 px-4 py-3.5 rounded-xl shadow-2xl sm:max-w-md w-auto text-left pointer-events-auto transition-all animate-in fade-in slide-in-from-top-4"
    >
      <span
        className={`w-3 h-3 rounded-full shrink-0 ${
          type === "success"
            ? "bg-emerald-500 shadow-lg shadow-emerald-500/50"
            : type === "error"
            ? "bg-red-500 shadow-lg shadow-red-500/50"
            : "bg-blue-500 shadow-lg shadow-blue-500/50"
        }`}
      ></span>
      <p className="text-xs text-white font-semibold leading-normal break-words min-w-0 flex-1">
        {message}
      </p>
      <button
        aria-label="Cerrar notificación"
        type="button"
        onClick={onClose}
        className="text-gray-400 hover:text-white text-xs font-bold pl-2 cursor-pointer transition-colors shrink-0"
      >
        ✕
      </button>
    </div>
  );

  return createPortal(content, document.body);
}
