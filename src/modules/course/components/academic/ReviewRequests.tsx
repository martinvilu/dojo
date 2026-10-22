"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { showToast } from "@/components/dashboard/ui/ToastNotification";
import type { ConditionResult } from "./types";

interface ReviewRequest {
  id: string;
  student_name: string;
  kind: string;
  ref_label: string;
  status: "open" | "answered" | "closed";
  messages: { by_name: string; role: "student" | "staff"; text: string; at: string }[];
}

const STATUS_LABEL = { open: "Abierta", answered: "Respondida", closed: "Cerrada" } as const;
const STATUS_STYLE = {
  open: "bg-amber-950/60 border-amber-700/60 text-amber-300",
  answered: "bg-blue-950/60 border-blue-700/60 text-blue-300",
  closed: "bg-neutral-800 border-neutral-700 text-gray-400",
} as const;
const inputClass = "w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white";

/** Opciones de "¿sobre qué es tu consulta?" a partir de la ficha del alumno. */
function referenceOptions(result: ConditionResult | null) {
  const options = [{ value: "attendance|", label: "Mi asistencia" }];
  for (const tp of result?.tps.items || []) options.push({ value: `submission|${tp.id}`, label: `Entrega: ${tp.title}` });
  for (const p of result?.partials || []) options.push({ value: `assessment|${p.id}`, label: `Nota: ${p.label}` });
  options.push({ value: "other|", label: "Otro" });
  return options;
}

/**
 * Consultas de revisión (SPEC §1.3): el alumno abre un hilo sobre una celda
 * de su ficha; la cátedra responde y lo cierra.
 */
export function ReviewRequests({ courseId, mode, condition }: {
  courseId: string;
  mode: "staff" | "student";
  condition?: ConditionResult | null;
}) {
  const [requests, setRequests] = useState<ReviewRequest[]>([]);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState({ ref: "attendance|", message: "" });
  const [showClosed, setShowClosed] = useState(false);

  const load = useCallback(async () => {
    try {
      setRequests(await api("getReviewRequests", { courseId }) || []);
    } catch (err: any) {
      showToast("Error al cargar consultas: " + err.message, "error");
    }
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

  const options = referenceOptions(condition || null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const [kind, refId] = draft.ref.split("|");
    const label = options.find((o) => o.value === draft.ref)?.label || "Consulta";
    try {
      await api("createReviewRequest", { courseId, kind, refId: refId || null, refLabel: label, message: draft.message });
      setDraft({ ref: "attendance|", message: "" });
      await load();
      showToast("Consulta enviada a la cátedra.", "success");
    } catch (err: any) {
      showToast("No se pudo enviar: " + err.message, "error");
    }
  };

  const reply = async (request: ReviewRequest, close = false) => {
    try {
      await api("replyReviewRequest", { requestId: request.id, message: replies[request.id] || null, close });
      setReplies((prev) => ({ ...prev, [request.id]: "" }));
      await load();
    } catch (err: any) {
      showToast("No se pudo responder: " + err.message, "error");
    }
  };

  const visible = requests.filter((r) => showClosed || r.status !== "closed");

  return (
    <div className="space-y-4">
      {mode === "student" && (
        <form onSubmit={create} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label htmlFor="reviewRef" className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">¿Sobre qué?</label>
            <select id="reviewRef" value={draft.ref} onChange={(e) => setDraft({ ...draft, ref: e.target.value })} className={inputClass}>
              {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="reviewMessage" className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Tu consulta</label>
            <input id="reviewMessage" value={draft.message} onChange={(e) => setDraft({ ...draft, message: e.target.value })} minLength={3} maxLength={3000} required
              placeholder="Ej: el 12/05 estuve presente pero figuro ausente" className={inputClass} />
          </div>
          <button type="submit" className="justify-self-start px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold cursor-pointer">Enviar consulta</button>
        </form>
      )}

      <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
        <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} className="rounded bg-neutral-950 border-neutral-800" />
        Mostrar cerradas
      </label>

      {visible.length === 0 && <p className="text-xs text-gray-500">{mode === "staff" ? "No hay consultas pendientes." : "No tenés consultas abiertas."}</p>}
      <ul className="space-y-3">
        {visible.map((r) => (
          <li key={r.id} className="p-4 rounded-xl border border-neutral-800 bg-neutral-950 space-y-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
              <span className="font-semibold text-white">{r.ref_label}</span>
              {mode === "staff" && <span className="text-gray-400">· {r.student_name}</span>}
            </div>
            <ul className="space-y-1.5">
              {r.messages.map((m, i) => (
                <li key={i} className={m.role === "staff" ? "pl-4 border-l-2 border-blue-700" : ""}>
                  <span className="text-gray-500">{m.by_name} · {new Date(m.at).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}</span>
                  <p className="text-gray-200">{m.text}</p>
                </li>
              ))}
            </ul>
            {r.status !== "closed" && (
              <div className="flex flex-wrap gap-2 items-center">
                <input value={replies[r.id] || ""} onChange={(e) => setReplies((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  aria-label={`Responder consulta sobre ${r.ref_label}`} placeholder="Responder…" maxLength={3000} className={`${inputClass} flex-1 min-w-[200px]`} />
                <button type="button" onClick={() => reply(r)} disabled={!(replies[r.id] || "").trim()} className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-xl font-semibold text-gray-200 cursor-pointer disabled:opacity-40">Responder</button>
                {mode === "staff" && <button type="button" onClick={() => reply(r, true)} className="px-3 py-2 text-emerald-400 hover:underline cursor-pointer">Cerrar</button>}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
