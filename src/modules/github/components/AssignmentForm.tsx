"use client";

import { useState } from "react";

export interface AssignmentFormValues {
  title: string;
  template_repo: string;
  create_feedback_pr: boolean;
  is_group: boolean;
  due_date: string;
  is_required: boolean;
}

const EMPTY: AssignmentFormValues = { title: "", template_repo: "", create_feedback_pr: false, is_group: false, due_date: "", is_required: true };

export function toFormValues(a: any): AssignmentFormValues {
  return {
    title: a.title || "",
    template_repo: a.template_repo || "",
    create_feedback_pr: Boolean(a.create_feedback_pr),
    is_group: Boolean(a.is_group),
    due_date: String(a.due_date || "").slice(0, 10),
    is_required: a.is_required !== false,
  };
}

/**
 * Alta y edición de un trabajo práctico. El padre lo remonta con `key` al
 * cambiar de tarea; `onSubmit` devuelve true si guardó, para vaciar el form.
 */
export function AssignmentForm({ editing, onSubmit, onCancel }: {
  editing: AssignmentFormValues | null;
  onSubmit: (values: AssignmentFormValues) => Promise<boolean>;
  onCancel: () => void;
}) {
  const initial = editing || EMPTY;
  const [assignTitle, setAssignTitle] = useState(initial.title);
  const [assignTemplate, setAssignTemplate] = useState(initial.template_repo);
  const [assignPr, setAssignPr] = useState(initial.create_feedback_pr);
  const [assignGroup, setAssignGroup] = useState(initial.is_group);
  const [assignDueDate, setAssignDueDate] = useState(initial.due_date);
  const [assignRequired, setAssignRequired] = useState(initial.is_required);
  const isEditing = editing !== null;

  const reset = () => {
    setAssignTitle(""); setAssignTemplate(""); setAssignPr(false); setAssignGroup(false); setAssignDueDate(""); setAssignRequired(true);
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    const saved = await onSubmit({
      title: assignTitle, template_repo: assignTemplate, create_feedback_pr: assignPr,
      is_group: assignGroup, due_date: assignDueDate, is_required: assignRequired,
    });
    if (saved) reset();
  };

  return (
    <form onSubmit={handleCreateAssignment} className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 space-y-4">
      <h4 className="font-bold text-sm text-gray-400 uppercase tracking-wider">{isEditing ? "✏️ Editar Tarea" : "➕ Crear Nueva Tarea"}</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="assignTitle" className="block text-xs font-semibold text-gray-400 mb-1">Título de la Tarea</label>
          <input id="assignTitle" type="text" value={assignTitle} onChange={(e) => setAssignTitle(e.target.value)} placeholder="Ej: Trabajo Práctico 1" className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white" required />
        </div>
        <div>
          <label htmlFor="assignTemplate" className="block text-xs font-semibold text-gray-400 mb-1">Repositorio Plantilla (org/repo)</label>
          <input id="assignTemplate" type="text" value={assignTemplate} onChange={(e) => setAssignTemplate(e.target.value)} placeholder="Ej: unrn-prog2-2026/tp1-plantilla" className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white" required />
        </div>
        <div>
          <label htmlFor="assignDueDate" className="block text-xs font-semibold text-gray-400 mb-1">Fecha límite (vence 23:59)</label>
          <input id="assignDueDate" type="date" value={assignDueDate} onChange={(e) => setAssignDueDate(e.target.value)} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white" />
        </div>
      </div>
      <div className="flex space-x-6 items-center">
        <label htmlFor="assignPr" className="flex items-center space-x-2 text-xs font-semibold text-gray-400 cursor-pointer">
          <input id="assignPr" type="checkbox" checked={assignPr} onChange={(e) => setAssignPr(e.target.checked)} className="rounded bg-neutral-950 border-neutral-800 text-blue-600 focus:ring-0" />
          <span>Crear Pull Request de Feedback</span>
        </label>
        <label htmlFor="assignGroup" className="flex items-center space-x-2 text-xs font-semibold text-gray-400 cursor-pointer">
          <input id="assignGroup" type="checkbox" checked={assignGroup} onChange={(e) => setAssignGroup(e.target.checked)} className="rounded bg-neutral-950 border-neutral-800 text-blue-600 focus:ring-0" />
          <span>Tarea Grupal</span>
        </label>
        <label htmlFor="assignRequired" className="flex items-center space-x-2 text-xs font-semibold text-gray-400 cursor-pointer">
          <input id="assignRequired" type="checkbox" checked={assignRequired} onChange={(e) => setAssignRequired(e.target.checked)} className="rounded bg-neutral-950 border-neutral-800 text-blue-600 focus:ring-0" />
          <span>Obligatorio para regularizar</span>
        </label>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition">{isEditing ? "Guardar Cambios" : "Crear Tarea"}</button>
        {isEditing && <button type="button" onClick={() => { reset(); onCancel(); }} className="px-5 py-2.5 bg-neutral-950 border border-neutral-800 text-gray-400 rounded-xl text-xs font-semibold transition">Cancelar</button>}
      </div>
    </form>
  );
}
