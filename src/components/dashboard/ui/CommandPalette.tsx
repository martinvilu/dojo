"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface CommandResult {
  key: string;
  type: "course" | "class" | "assignment";
  title: string;
  subtitle?: string;
  courseRef: any;
  subTab?: "schedules" | "assignments";
}

interface CommandPaletteProps {
  /** Courses currently loaded for the user ({ id, name }) */
  courses: any[];
  /** Class instances across subjects (topic + course_id/course_name) */
  classes: any[];
  /** Assignments across subjects (title + course_id/course_name) */
  assignments: any[];
  onNavigate: (result: CommandResult) => void;
}

const normalize = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const TYPE_META: Record<CommandResult["type"], { label: string; icon: string }> = {
  course: { label: "Cátedra", icon: "📚" },
  class: { label: "Clase", icon: "📅" },
  assignment: { label: "Tarea", icon: "📝" },
};

/**
 * Omni search palette (Cmd/Ctrl + K). Self-contained: installs its own
 * global shortcut and overlay. Searches the already-loaded dashboard state
 * (subjects, class topics and assignment titles) and delegates navigation.
 */
export default function CommandPalette({ courses, classes, assignments, onNavigate }: CommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const close = useCallback(() => setIsOpen(false), []);

  const results = useMemo<CommandResult[]>(() => {
    const q = normalize(query.trim());
    const out: CommandResult[] = [];

    const push = (r: CommandResult) => {
      if (out.length < 12 && !out.some((x) => x.key === r.key)) out.push(r);
    };

    const courseRefOf = (cid?: string) =>
      courses.find((c: any) => (c.id || c.course?.id) === cid) || null;

    // Courses always listed when they match or when nothing was typed
    courses.forEach((c: any) => {
      const id = c.id || c.course?.id;
      if (!id) return;
      if (!q || normalize(c.name).includes(q)) {
        push({ key: `course-${id}`, type: "course", title: c.name || "Cátedra", subtitle: "Cátedra", courseRef: c });
      }
    });

    if (q) {
      classes.forEach((cl: any) => {
        const topic = normalize(cl.topic);
        if (topic && topic.includes(q)) {
          push({
            key: `class-${cl.course_id}-${cl.classNumber ?? cl.date}`,
            type: "class",
            title: cl.topic,
            subtitle: `${cl.course_name || "Cátedra"}${cl.date ? ` · ${String(cl.date).slice(0, 10)}` : ""}`,
            courseRef: courseRefOf(cl.course_id),
            subTab: "schedules",
          });
        }
      });

      assignments.forEach((a: any) => {
        if (normalize(a.title).includes(q)) {
          push({
            key: `assign-${a.id}`,
            type: "assignment",
            title: a.title,
            subtitle: a.course_name || a.course_id ? `${a.course_name || ""}${a.due_date ? ` · ${String(a.due_date).slice(0, 10)}` : ""}` : undefined,
            courseRef: courseRefOf(a.course_id),
            subTab: "assignments",
          });
        }
      });
    }

    return out;
  }, [query, courses, classes, assignments]);

  const pick = useCallback(
    (r: CommandResult) => {
      if (!r.courseRef) return;
      close();
      onNavigate(r);
    },
    [close, onNavigate]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = results[activeIndex];
      if (r) pick(r);
    }
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[999998] flex items-start justify-center pt-[12vh] px-4"
          onClick={close}
          role="presentation"
        >
          <div
            className="w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Buscador rápido"
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border-custom">
              <span aria-hidden="true">🔎</span>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={onKeyDown}
                placeholder="Buscar cátedras, clases y tareas…"
                className="flex-1 bg-transparent outline-none text-sm text-text-primary placeholder:text-text-secondary"
                aria-label="Buscar cátedras, clases y tareas"
              />
              <kbd className="text-[9px] font-bold text-text-secondary bg-bg-primary border border-border-custom rounded px-1.5 py-0.5">
                ESC
              </kbd>
            </div>

            <ul className="max-h-[50vh] overflow-y-auto p-2" role="listbox">
              {results.length === 0 && (
                <li className="px-3 py-8 text-center text-xs text-text-secondary italic">
                  Sin resultados para “{query}”.
                </li>
              )}
              {results.map((r, idx) => (
                <li key={r.key} role="option" aria-selected={idx === activeIndex}>
                  <button
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => pick(r)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition cursor-pointer ${
                      idx === activeIndex ? "bg-blue-600/15 ring-1 ring-blue-500/40" : "hover:bg-bg-primary"
                    }`}
                  >
                    <span className="text-base shrink-0" aria-hidden="true">{TYPE_META[r.type].icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-text-primary truncate">{r.title}</span>
                      {r.subtitle && (
                        <span className="block text-[10px] text-text-secondary truncate">{r.subtitle}</span>
                      )}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-text-secondary shrink-0">
                      {TYPE_META[r.type].label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="px-4 py-2 border-t border-border-custom flex items-center gap-3 text-[9px] text-text-secondary">
              <span><kbd className="font-bold">↑↓</kbd> navegar</span>
              <span><kbd className="font-bold">↵</kbd> abrir</span>
              <span className="ml-auto"><kbd className="font-bold">⌘K</kbd> alternar</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
