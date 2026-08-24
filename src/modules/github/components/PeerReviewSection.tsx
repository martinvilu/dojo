"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { showToast } from "@/components/dashboard/ui/ToastNotification";

interface PeerReviewSectionProps {
  mode: "teacher" | "student";
  courseId: string;
  assignment?: any;
  showToast?: (msg: string, type?: string) => void;
  setApiLoading?: (v: boolean) => void;
}

/**
 * Rubric-based peer review UI.
 * - Teacher: per-assignment enable/disable toggle with rubric summary.
 * - Student: pending reviewees per enabled assignment plus an inline
 *   rubric scoring form; reviews stay anonymous towards reviewees.
 */
export default function PeerReviewSection(props: PeerReviewSectionProps) {
  if (props.mode === "teacher") return <TeacherControls {...props} />;
  return <StudentBoard {...props} />;
}

function TeacherControls({ assignment, showToast = (m: string) => alert(m), setApiLoading = () => {} }: PeerReviewSectionProps) {
  const [enabled, setEnabled] = useState<boolean>(Boolean(assignment?.peer_review?.enabled));
  const [saving, setSaving] = useState(false);

  const toggle = async () => {
    setSaving(true);
    try {
      const nextEnabled = !enabled;
      await api("enablePeerReview", { assignmentId: assignment.id, enabled: nextEnabled });
      setEnabled(nextEnabled);
      showToast(nextEnabled ? "Revisión entre pares activada." : "Revisión entre pares desactivada.", "success");
    } catch (err: any) {
      showToast("Error: " + err.message, "error");
    } finally {
      setSaving(false);
      setApiLoading(false);
    }
  };

  const rubric = assignment?.peer_review?.rubric || [];

  return (
    <div className="bg-neutral-950/40 border border-neutral-850 rounded-xl p-3 space-y-2">
      <div className="flex justify-between items-center gap-2">
        <span className="text-xs font-bold text-gray-300">👥 Revisión entre Pares</span>
        <button
          type="button"
          disabled={saving}
          onClick={toggle}
          className={`px-3 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
            enabled ? "bg-red-950/50 text-red-400 hover:bg-red-900/40" : "bg-blue-600 hover:bg-blue-500 text-white"
          }`}
        >
          {saving ? "…" : enabled ? "Desactivar" : "Activar"}
        </button>
      </div>
      {enabled && (
        <div className="space-y-1 pt-1 border-t border-neutral-900">
          {rubric.map((c: any, i: number) => (
            <p key={i} className="text-[10px] text-gray-400 font-mono">• {c.name} (máx {c.maxPoints})</p>
          ))}
        </div>
      )}
    </div>
  );
}

function StudentBoard({ courseId, showToast = (m: string) => alert(m), setApiLoading = () => {} }: PeerReviewSectionProps) {
  const [reviewables, setReviewables] = useState<any[] | null>(null);
  const [activeForm, setActiveForm] = useState<{ assignmentId: string; revieweeId: string; rubric: any[] } | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api("getMyReviewAssignments", { courseId })
      .then((res) => { if (!cancelled) setReviewables((res || []).filter((r: any) => r.has_submitted && (r.pending_reviewees.length > 0 || r.reviewed_count > 0))); })
      .catch(() => { if (!cancelled) setReviewables([]); });
    return () => { cancelled = true; };
  }, [courseId]);

  if (!reviewables || reviewables.length === 0) return null;

  const openForm = (assignmentId: string, revieweeId: string, rubric: any[]) => {
    setActiveForm({ assignmentId, revieweeId, rubric });
    setScores(Object.fromEntries(rubric.map((c: any) => [c.name, 0])));
    setComment("");
  };

  const submit = async () => {
    if (!activeForm) return;
    setSubmitting(true);
    try {
      await api("submitPeerReview", {
        assignmentId: activeForm.assignmentId,
        revieweeId: activeForm.revieweeId,
        scores,
        comment
      });
      showToast("¡Revisión enviada! Gracias por ayudar a tus compañeros.", "success");
      setActiveForm(null);
      const res = await api("getMyReviewAssignments", { courseId });
      setReviewables((res || []).filter((r: any) => r.has_submitted && (r.pending_reviewees.length > 0 || r.reviewed_count > 0)));
    } catch (err: any) {
      showToast("Error: " + err.message, "error");
    } finally {
      setSubmitting(false);
      setApiLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-bold text-white flex items-center space-x-2">
        <span>👥 Revisión entre Pares</span>
        <span className="text-[9px] bg-purple-950/50 text-purple-400 px-2 py-0.5 rounded-lg border border-purple-900/40 uppercase tracking-wider">Anónima para tus compañeros</span>
      </h4>
      {reviewables.map((r: any) => (
        <div key={r.assignment_id} className="bg-neutral-900/30 border border-neutral-800 rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <span className="text-xs font-bold text-gray-200">{r.title}</span>
            <span className="text-[10px] text-gray-500">{r.reviewed_count} revisada(s)</span>
          </div>

          {r.pending_reviewees.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {r.pending_reviewees.map((rid: string) => (
                <button
                  key={rid}
                  type="button"
                  onClick={() => openForm(r.assignment_id, rid, r.rubric)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer ${
                    activeForm?.revieweeId === rid && activeForm.assignmentId === r.assignment_id
                      ? "bg-purple-600 text-white"
                      : "bg-neutral-950 border border-neutral-800 text-gray-300 hover:text-white hover:border-purple-700"
                  }`}
                >
                  Revisar entrega #{rid.slice(0, 6)}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-gray-500 italic">Ya revisaste a todos tus compañeros asignados. ¡Gracias!</p>
          )}

          {activeForm && activeForm.assignmentId === r.assignment_id && (() => {
            const af = activeForm;
            return (
            <div className="bg-neutral-950/70 border border-neutral-850 rounded-xl p-4 space-y-3 animate-in fade-in duration-200">
              <p className="text-[10px] text-gray-500">Estás calificando la entrega <strong>#{af.revieweeId.slice(0, 6)}</strong>. Tu identidad no se muestra al compañero.</p>
              {af.rubric.map((c: any) => (
                <div key={c.name} className="flex items-center justify-between gap-3">
                  <label className="text-xs text-gray-300 flex-1">{c.name} <span className="text-gray-600">(0-{c.maxPoints})</span></label>
                  <input
                    type="number"
                    min={0}
                    max={c.maxPoints}
                    value={scores[c.name] ?? 0}
                    onChange={(e) => setScores({ ...scores, [c.name]: Number(e.target.value) })}
                    className="w-20 bg-black border border-neutral-800 rounded-lg px-2 py-1 text-xs text-center font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              ))}
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Comentario constructivo para tu compañero (opcional)…"
                rows={2}
                maxLength={2000}
                className="w-full bg-black border border-neutral-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-500"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={submit}
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  {submitting ? "Enviando…" : "Enviar Revisión"}
                </button>
              </div>
            </div>
            );
          })()}
        </div>
      ))}
    </div>
  );
}
