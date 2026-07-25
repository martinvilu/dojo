"use client";

import React from "react";

export type AlertBadgeType = "critical" | "warning" | "success" | "info" | "none";

export interface AlertBadgeProps {
  type: AlertBadgeType;
  label?: string;
  icon?: React.ReactNode;
  badgeId?: string;
  className?: string;
}

export default function AlertBadge({
  type,
  label,
  icon,
  badgeId,
  className = ""
}: AlertBadgeProps) {
  const getStyles = () => {
    switch (type) {
      case "critical":
        return {
          bg: "bg-red-950/90 border-red-700/60 text-red-300",
          defaultIcon: "⚠️",
          defaultLabel: "Asistencia Crítica (<75%)"
        };
      case "warning":
        return {
          bg: "bg-amber-950/90 border-amber-700/60 text-amber-300",
          defaultIcon: "⚠️",
          defaultLabel: "Tareas Atrasadas"
        };
      case "success":
        return {
          bg: "bg-emerald-950/90 border-emerald-700/60 text-emerald-300",
          defaultIcon: "✅",
          defaultLabel: "Sin Alertas"
        };
      case "info":
        return {
          bg: "bg-blue-950/90 border-blue-700/60 text-blue-300",
          defaultIcon: "ℹ️",
          defaultLabel: "Información"
        };
      case "none":
      default:
        return {
          bg: "bg-neutral-900 border-neutral-800 text-neutral-400",
          defaultIcon: null,
          defaultLabel: "Sin Alertas"
        };
    }
  };

  const styleConfig = getStyles();
  const displayLabel = label || styleConfig.defaultLabel;
  const displayIcon = icon !== undefined ? icon : styleConfig.defaultIcon;

  return (
    <div
      id={badgeId}
      role="status"
      className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold uppercase tracking-wide min-w-[170px] whitespace-nowrap shadow-sm transition-colors ${styleConfig.bg} ${className}`}
    >
      {displayIcon && <span className="shrink-0 text-sm leading-none">{displayIcon}</span>}
      <span>{displayLabel}</span>
    </div>
  );
}
