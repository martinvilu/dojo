"use client";

import React, { useSyncExternalStore } from "react";
import BaseModal from "./BaseModal";

export interface ConfirmOptions {
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" styles the confirm button for destructive actions. */
  tone?: "default" | "danger";
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

// Tiny external store: a FIFO queue of pending confirmations rendered one at
// a time by <ConfirmDialogHost />, mounted once in the root layout.
let queue: PendingConfirm[] = [];
let hostMounted = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getCurrent = () => queue[0] ?? null;
const getServerCurrent = () => null;

/**
 * Accessible replacement for window.confirm(): resolves true when the user
 * confirms and false when they cancel, press Escape or close the dialog.
 *
 *   if (!(await confirmAction({ message: "¿Archivar la tarea?", tone: "danger" }))) return;
 *
 * Falls back to window.confirm when the host is not mounted.
 */
export function confirmAction(options: ConfirmOptions | string): Promise<boolean> {
  const normalized = typeof options === "string" ? { message: options } : options;
  if (typeof window === "undefined") return Promise.resolve(false);
  if (!hostMounted) return Promise.resolve(window.confirm(normalized.message));

  return new Promise((resolve) => {
    queue = [...queue, { ...normalized, resolve }];
    emit();
  });
}

function settle(confirmed: boolean) {
  const [current, ...rest] = queue;
  if (!current) return;
  queue = rest;
  emit();
  current.resolve(confirmed);
}

export function ConfirmDialogHost() {
  const current = useSyncExternalStore(subscribe, getCurrent, getServerCurrent);

  React.useEffect(() => {
    hostMounted = true;
    return () => {
      hostMounted = false;
    };
  }, []);

  if (!current) return null;

  const danger = current.tone === "danger";
  const cancel = () => settle(false);

  return (
    <BaseModal
      isOpen
      onClose={cancel}
      title={current.title ?? (danger ? "Confirmar acción" : "Confirmación")}
      icon={danger ? "⚠️" : "❔"}
      maxWidthClass="max-w-md"
      minWidthClass="min-w-[280px] sm:min-w-[400px]"
      zIndexClass="z-[1000000]"
      modalId="confirm-dialog"
      footer={
        <>
          {/* Cancel comes first so it receives the initial focus: Enter never confirms by accident. */}
          <button
            type="button"
            onClick={cancel}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-xs font-bold text-gray-200 rounded-xl transition cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-400"
          >
            {current.cancelLabel ?? "Cancelar"}
          </button>
          <button
            type="button"
            id="btn-confirm-action"
            onClick={() => settle(true)}
            className={`px-4 py-2 text-white text-xs font-bold rounded-xl transition cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-400 ${
              danger ? "bg-red-600 hover:bg-red-500" : "bg-blue-600 hover:bg-blue-500"
            }`}
          >
            {current.confirmLabel ?? "Confirmar"}
          </button>
        </>
      }
    >
      <p className="whitespace-pre-line">{current.message}</p>
    </BaseModal>
  );
}
