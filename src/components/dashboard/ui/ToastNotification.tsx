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
      className="fixed bottom-4 left-4 right-4 sm:bottom-auto sm:top-6 sm:left-auto sm:right-6 max-w-[calc(100vw-2rem)] sm:max-w-md w-auto z-[999999] flex items-center space-x-3 bg-neutral-900/95 border border-neutral-700/80 backdrop-blur-md p-4 rounded-2xl shadow-2xl text-left pointer-events-auto transition-all animate-in fade-in slide-in-from-bottom-4 sm:slide-in-from-top-4"
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
      <p className="text-xs sm:text-sm text-white font-medium leading-relaxed break-words whitespace-pre-wrap min-w-0 flex-1">
        {message}
      </p>
      <button
        aria-label="Cerrar notificación"
        type="button"
        onClick={onClose}
        className="text-gray-400 hover:text-white text-sm font-bold p-1 cursor-pointer transition-colors shrink-0"
      >
        ✕
      </button>
    </div>
  );

  return createPortal(content, document.body);
}
