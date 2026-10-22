"use client";

import React from "react";

export type KanbanColumn = "Teórica" | "Práctica" | "Feriado" | "Examen";

interface ColumnDef {
  id: KanbanColumn;
  title: string;
  empty: string;
  fallbackTopic: string;
  matches: (c: any) => boolean;
  cardClass: string;
  countClass: string;
  accentClass: string;
}

const COLUMNS: ColumnDef[] = [
  {
    id: "Teórica", title: "📖 Teóricas", empty: "Arrastra clases aquí.", fallbackTopic: "Sin Tema",
    matches: (c) => c.type === "Teórica" && c.special_status === "Normal",
    cardClass: "bg-neutral-950 border border-neutral-855 hover:border-neutral-700",
    countClass: "bg-neutral-800 text-gray-400", accentClass: "text-gray-550",
  },
  {
    id: "Práctica", title: "🛠️ Prácticas", empty: "Arrastra clases aquí.", fallbackTopic: "Sin Tema",
    matches: (c) => c.type === "Práctica" && c.special_status === "Normal",
    cardClass: "bg-neutral-955 border border-neutral-855 hover:border-neutral-700",
    countClass: "bg-neutral-800 text-gray-400", accentClass: "text-gray-550",
  },
  {
    id: "Feriado", title: "🌴 Feriados", empty: "Arrastra feriados aquí.", fallbackTopic: "Sin Tema (Feriado)",
    matches: (c) => c.special_status === "Feriado",
    cardClass: "bg-neutral-955/5 border border-amber-955/20 hover:border-neutral-700 opacity-80",
    countClass: "bg-neutral-850 text-amber-500", accentClass: "text-amber-550",
  },
  {
    id: "Examen", title: "🏆 Exámenes", empty: "Arrastra exámenes aquí.", fallbackTopic: "Evaluación",
    matches: (c) => c.special_status === "Examen",
    cardClass: "bg-red-955/10 border border-red-955/35 hover:border-red-900/30",
    countClass: "bg-red-955 border border-red-900/30 text-red-400", accentClass: "text-red-450",
  },
];

/**
 * Tablero curricular: arrastrar una clase entre columnas cambia su tipo o
 * estado especial. Cada tarjeta tiene además un selector "Mover a" para
 * hacerlo con teclado o lector de pantalla (SPEC §4, WCAG 2.1.1).
 */
export function ScheduleKanban({ classes, onMove, formatDate }: {
  classes: any[];
  onMove: (classIdx: number, column: KanbanColumn) => void;
  formatDate: (date: Date) => string;
}) {
  const indexed = classes.map((c, i) => ({ ...c, originalIndex: i }));
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start select-none">
      {COLUMNS.map((col) => {
        const colClasses = indexed.filter(col.matches);
        return (
          <section
            key={col.id}
            aria-label={`${col.title.replace(/^\S+\s/, "")}: ${colClasses.length} clases`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onMove(parseInt(e.dataTransfer.getData("text/plain")), col.id)}
            className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-4 space-y-4 min-h-[400px] flex flex-col"
          >
            <div className="flex justify-between items-center border-b border-neutral-850 pb-2">
              <h4 className="font-bold text-xs text-white uppercase tracking-wider">{col.title}</h4>
              <span className={`font-mono text-[10px] px-2 py-0.5 rounded font-bold ${col.countClass}`}>{colClasses.length}</span>
            </div>
            <ul className="space-y-3 flex-1 overflow-y-auto max-h-[600px] custom-scrollbar">
              {colClasses.map((item) => (
                <li
                  key={item.originalIndex}
                  draggable="true"
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", item.originalIndex.toString())}
                  className={`p-4 rounded-xl space-y-2 cursor-grab active:cursor-grabbing transition ${col.cardClass}`}
                >
                  <div className="flex justify-between items-center text-[10px]">
                    <span className={`font-bold ${col.accentClass}`}>Clase {item.originalIndex + 1}</span>
                    <span className="text-gray-550">{formatDate(new Date(item.date))}</span>
                  </div>
                  <h5 className={`font-bold text-xs truncate ${col.id === "Examen" ? "text-red-200" : "text-white"}`}>{item.topic || col.fallbackTopic}</h5>
                  {item.description && col.id !== "Feriado" && col.id !== "Examen" && (
                    <p className="text-[10px] text-gray-450 truncate">{item.description}</p>
                  )}
                  <label className="flex items-center gap-1 text-[10px] text-gray-500">
                    <span className="sr-only">Mover clase {item.originalIndex + 1} a</span>
                    <span aria-hidden="true">Mover a</span>
                    <select
                      value={col.id}
                      onChange={(e) => onMove(item.originalIndex, e.target.value as KanbanColumn)}
                      className="bg-neutral-950 border border-neutral-800 rounded px-1 py-0.5 text-[10px] text-gray-300 cursor-pointer"
                    >
                      {COLUMNS.map((target) => <option key={target.id} value={target.id}>{target.id}</option>)}
                    </select>
                  </label>
                </li>
              ))}
              {colClasses.length === 0 && (
                <li className="text-center text-[10px] text-gray-550 italic py-8">{col.empty}</li>
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
