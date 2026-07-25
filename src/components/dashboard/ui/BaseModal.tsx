"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string | React.ReactNode;
  subtitle?: string | React.ReactNode;
  icon?: string | React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidthClass?: string;
  minWidthClass?: string;
  zIndexClass?: string;
  modalId?: string;
}

export default function BaseModal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  maxWidthClass = "max-w-lg",
  minWidthClass = "min-w-[280px] sm:min-w-[480px]",
  zIndexClass = "z-[99999]",
  modalId
}: BaseModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted || typeof document === "undefined") return null;

  const content = (
    <div
      id={modalId}
      role="dialog"
      aria-modal="true"
      className={`fixed inset-0 bg-black/80 backdrop-blur-md ${zIndexClass} flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200`}
    >
      <div
        className={`bg-neutral-900 border border-neutral-800 p-6 rounded-2xl shadow-2xl w-full ${maxWidthClass} ${minWidthClass} shrink-0 mx-auto max-h-[90vh] overflow-y-auto space-y-4 relative z-10 text-left pointer-events-auto`}
      >
        <div className="flex justify-between items-start border-b border-neutral-800 pb-3">
          <div className="space-y-0.5">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              {icon && <span className="shrink-0">{icon}</span>}
              <span>{title}</span>
            </h3>
            {subtitle && (
              <div className="text-xs text-neutral-400 font-medium">
                {subtitle}
              </div>
            )}
          </div>
          <button
            aria-label="Cerrar modal"
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-white text-sm font-bold cursor-pointer transition-colors p-1 rounded-lg hover:bg-neutral-800 shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="w-full text-neutral-200 text-xs sm:text-sm leading-relaxed">
          {children}
        </div>

        {footer && (
          <div className="flex justify-end items-center space-x-3 pt-3 border-t border-neutral-800/80">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
