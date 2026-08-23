"use client";

import React from "react";

interface MarkdownToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
}

type Action = {
  label: React.ReactNode;
  title: string;
  wrap?: [string, string];
  linePrefix?: string;
};

const ACTIONS: Action[] = [
  { label: <strong>B</strong>, title: "Negrita (**texto**)", wrap: ["**", "**"] },
  { label: <em>I</em>, title: "Itálica (*texto*)", wrap: ["*", "*"] },
  { label: <span className="underline">H</span>, title: "Título (## texto)", linePrefix: "## " },
  { label: <span>•</span>, title: "Lista (- ítem)", linePrefix: "- " },
  { label: <span>&lt;/&gt;</span>, title: "Código (`código`)", wrap: ["`", "`"] },
  { label: <span>🔗</span>, title: "Enlace ([texto](url))", wrap: ["[", "](https://)"] },
];

/**
 * Lightweight markdown formatting toolbar for textareas whose content is
 * rendered through `marked`. Zero dependencies; operates on the textarea
 * selection and reports the new value through onChange.
 */
export default function MarkdownToolbar({ textareaRef, value, onChange }: MarkdownToolbarProps) {
  const apply = (action: Action) => {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const selected = value.slice(start, end);
    let next: string;
    let selStart: number;
    let selEnd: number;

    if (action.wrap) {
      const [before, after] = action.wrap;
      next = value.slice(0, start) + before + selected + after + value.slice(end);
      selStart = start + before.length;
      selEnd = selStart + selected.length;
    } else if (action.linePrefix) {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      next = value.slice(0, lineStart) + action.linePrefix + value.slice(lineStart);
      selStart = lineStart + action.linePrefix.length;
      selEnd = selStart + selected.length;
    } else {
      return;
    }

    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selStart, selEnd);
    });
  };

  return (
    <div
      className="flex items-center gap-1 pb-2 border-b border-neutral-850 mb-2"
      role="toolbar"
      aria-label="Formato Markdown"
    >
      {ACTIONS.map((a, i) => (
        <button
          key={i}
          type="button"
          title={a.title}
          aria-label={a.title}
          onClick={() => apply(a)}
          className="min-w-[26px] min-h-[24px] px-1.5 rounded-md bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-[11px] font-bold text-gray-300 hover:text-white transition cursor-pointer"
        >
          {a.label}
        </button>
      ))}
      <span className="ml-auto text-[9px] text-gray-500 italic">Markdown soportado</span>
    </div>
  );
}
