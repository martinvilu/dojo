"use client";

import { useEffect } from "react";
import { showToast as toastNotify, ToastOptions } from "nextjs-toast-notify";

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
  // third parameter kept for API compatibility with the component wrapper
  _toastId: string = "toast-container"
) {
  if (typeof window === "undefined") return;

  const options: ToastOptions = {
    duration: 4000,
    progress: true,
    position: "bottom-center",
    transition: "slideInUp",
    sound: false
  };

  const msg = String(message || "");

  switch (type) {
    case "error":
      toastNotify.error(msg, options);
      break;
    case "warning":
      toastNotify.warning(msg, options);
      break;
    case "info":
      toastNotify.info(msg, options);
      break;
    case "success":
    default:
      toastNotify.success(msg, options);
      break;
  }
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
  return null;
}
