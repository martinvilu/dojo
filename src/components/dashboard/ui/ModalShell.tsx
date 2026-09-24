"use client";

import React from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

export interface ModalShellProps {
  /** Closes the dialog; wired to Escape. Omit for dialogs that must not close from the keyboard. */
  onClose?: () => void;
  /** Accessible name announced by screen readers. */
  ariaLabel: string;
  /** Classes of the full-screen backdrop. */
  overlayClassName?: string;
  /** Classes of the dialog panel. */
  className?: string;
  children: React.ReactNode;
}

const DEFAULT_OVERLAY =
  "fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto";

/**
 * Backdrop + dialog panel with focus trap, Escape handling and focus
 * restoration, for modals that keep their own markup instead of BaseModal.
 * Render it conditionally (`{isOpen && <ModalShell …>}`): the trap is active
 * while it is mounted.
 */
export default function ModalShell({
  onClose,
  ariaLabel,
  overlayClassName = DEFAULT_OVERLAY,
  className = "",
  children,
}: ModalShellProps) {
  const dialogRef = useFocusTrap<HTMLDivElement>(true, { onEscape: onClose });

  return (
    <div className={overlayClassName}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        className={`${className} outline-none`}
      >
        {children}
      </div>
    </div>
  );
}
