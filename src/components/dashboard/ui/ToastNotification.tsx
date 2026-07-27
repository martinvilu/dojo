"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export interface ToastNotificationProps {
  message: string;
  type?: "success" | "error" | "info" | "warning";
  onClose: () => void;
  toastId?: string;
  autoDismissMs?: number;
}

export default function ToastNotification({
  message,
  type = "success",
  onClose,
  toastId = "toast-container",
  autoDismissMs
}: ToastNotificationProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!autoDismissMs || autoDismissMs <= 0) return;
    const timer = setTimeout(() => {
      onClose();
    }, autoDismissMs);
    return () => clearTimeout(timer);
  }, [autoDismissMs, onClose]);

  if (!mounted || typeof document === "undefined") return null;

  const getTypeStyles = () => {
    switch (type) {
      case "error":
        return "bg-red-500 shadow-lg shadow-red-500/50";
      case "warning":
        return "bg-amber-500 shadow-lg shadow-amber-500/50";
      case "info":
        return "bg-blue-500 shadow-lg shadow-blue-500/50";
      case "success":
      default:
        return "bg-emerald-500 shadow-lg shadow-emerald-500/50";
    }
  };

  const content = (
    <div
      id={toastId}
      role="alert"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 sm:bottom-6 max-w-md w-[calc(100%-2rem)] mx-auto z-[9999999] flex items-center space-x-3 bg-neutral-900/95 border border-neutral-700/80 backdrop-blur-md p-4 rounded-2xl shadow-2xl text-left pointer-events-auto transition-all animate-in fade-in slide-in-from-bottom-4 box-border"
      style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
    >
      <span className={`w-3 h-3 rounded-full shrink-0 ${getTypeStyles()}`}></span>
      <p id="toast-msg" className="text-xs sm:text-sm text-white font-medium leading-relaxed break-words whitespace-pre-wrap min-w-0 flex-1 overflow-hidden">
        {message}
      </p>
      <button
        id="btn-close-toast"
        aria-label="Cerrar notificación"
        type="button"
        onClick={onClose}
        className="text-neutral-400 hover:text-white text-sm font-bold p-1 cursor-pointer transition-colors shrink-0 hover:bg-neutral-800 rounded-lg min-w-[28px] min-h-[28px] flex items-center justify-center"
      >
        ✕
      </button>
    </div>
  );

  return createPortal(content, document.body);
}
