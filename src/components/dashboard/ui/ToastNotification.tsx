"use client";

import React, { useEffect } from "react";
import { Toaster, toast } from "sonner";

export interface ToastNotificationProps {
  message: string;
  type?: "success" | "error" | "info" | "warning";
  onClose?: () => void;
  toastId?: string;
  autoDismissMs?: number;
}

export function showToast(
  message: string,
  type: "success" | "error" | "info" | "warning" = "success",
  toastId: string = "toast-container"
) {
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

  toast.custom(
    (t) => (
      <div
        id={toastId}
        role="alert"
        aria-live="polite"
        className="w-full max-w-md flex items-center space-x-3 bg-neutral-900/95 border border-neutral-700/80 backdrop-blur-md p-4 rounded-2xl shadow-2xl text-left pointer-events-auto box-border"
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
          onClick={() => toast.dismiss(t)}
          className="text-neutral-400 hover:text-white text-sm font-bold p-1 cursor-pointer transition-colors shrink-0 hover:bg-neutral-800 rounded-lg min-w-[28px] min-h-[28px] flex items-center justify-center"
        >
          ✕
        </button>
      </div>
    ),
    {
      id: "global-sonner-toast",
      duration: 4500
    }
  );
}

export default function ToastNotification({
  message,
  type = "success",
  toastId = "toast-container"
}: ToastNotificationProps) {
  useEffect(() => {
    if (message) {
      showToast(message, type, toastId);
    }
  }, [message, type, toastId]);

  return null;
}

export function AppToaster() {
  return (
    <Toaster
      position="bottom-center"
      theme="dark"
      containerAriaLabel="Notificaciones flotantes"
      style={{ zIndex: 9999999 }}
    />
  );
}
