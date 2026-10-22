import { showToast } from "@/components/dashboard/ui/ToastNotification";
import React, { useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  arrayRemove,
  arrayUnion,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/clientApp";
import { api } from "@/lib/api";
import { ClassComment, isSolutionComment } from "../../types";

const VIRTUALIZE_FROM = 40;
import { formatDateSafe, formatDateTime } from "@/lib/dates";
import { logger } from "@/lib/logger";

interface ClassCommentsThreadProps {
  classNumber: number;
  courseId: string;
  courseComments: ClassComment[];
  profile: {
    id: string;
    full_name?: string;
    email: string;
    role: "student" | "teacher" | "admin" | "tutor" | string;
  } | null;
}

export default function ClassCommentsThread({
  classNumber,
  courseId,
  courseComments,
  profile,
}: ClassCommentsThreadProps) {
  const [newCommentText, setNewCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleAddComment = async () => {
    const text = newCommentText.trim();
    if (!text || !profile) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, "courses", courseId, "class_comments"), {
        classNumber,
        user_id: profile.id,
        user_name: profile.full_name || profile.email,
        user_role: profile.role,
        content: text,
        reactions: {},
        created_at: serverTimestamp(),
      });
      setNewCommentText("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast("Error al enviar comentario: " + msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleReaction = async (commentId: string, reactionType: "thumbs_up" | "party" | "heart") => {
    if (!profile) return;
    const commentRef = doc(db, "courses", courseId, "class_comments", commentId);
    try {
      const commentDoc = await getDoc(commentRef);
      if (!commentDoc.exists()) return;

      const data = commentDoc.data();
      const currentReactions = (data.reactions?.[reactionType] as string[]) || [];
      const hasReacted = currentReactions.includes(profile.id);

      await updateDoc(commentRef, {
        [`reactions.${reactionType}`]: hasReacted
          ? arrayRemove(profile.id)
          : arrayUnion(profile.id),
      });
    } catch (err: unknown) {
      logger.error("Error toggling reaction:", err);
    }
  };

  const handleMarkBestAnswer = async (commentId: string, currentStatus: boolean) => {
    if (!profile) return;
    if (profile.role !== "teacher" && profile.role !== "admin") return;

    try {
      // El backend deja una sola solución por clase y le suma +100 XP al autor.
      await api("markCommentSolution", { courseId, commentId, isSolution: !currentStatus });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast("Error al marcar mejor respuesta: " + msg, "error");
    }
  };

  const filteredComments = courseComments.filter((c) => c.classNumber === classNumber);

  // Hilos largos: solo se dibujan los comentarios visibles (mejora 4.04).
  const listRef = useRef<HTMLDivElement>(null);
  const virtualized = filteredComments.length >= VIRTUALIZE_FROM;
  // eslint-disable-next-line react-hooks/incompatible-library -- el proyecto no usa React Compiler
  const virtualizer = useVirtualizer({
    count: virtualized ? filteredComments.length : 0,
    getScrollElement: () => listRef.current,
    estimateSize: () => 120,
    overscan: 6,
  });

  const renderComment = (comment: ClassComment) => (
    <div
      key={comment.id}
      className={`p-3.5 rounded-xl space-y-2 border transition ${
        isSolutionComment(comment)
          ? "border-emerald-500 bg-emerald-950/15"
          : "bg-neutral-955 border-neutral-850"
      }`}
    >
      <div className="flex justify-between items-center text-[10px]">
        <div className="flex items-center space-x-2">
          <span className={`font-bold ${comment.user_role === "teacher" ? "text-amber-400" : "text-blue-400"}`}>
            {comment.user_name} ({comment.user_role === "teacher" ? "Profesor" : "Estudiante"})
          </span>
          {isSolutionComment(comment) && (
            <span className="px-2 py-0.5 rounded bg-emerald-955 border border-emerald-800 text-emerald-400 text-[8px] font-bold uppercase tracking-wider">
              ✔️ Solución
            </span>
          )}
        </div>
        <span className="text-gray-500">
          {formatDateSafe(comment.created_at, formatDateTime)}
        </span>
      </div>
      <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{comment.content}</p>

      <div className="flex justify-between items-center pt-2 mt-1 border-t border-neutral-900/60 text-[10px]">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleToggleReaction(comment.id, "thumbs_up")}
            className={`px-2 py-0.5 rounded border flex items-center gap-1 transition-colors cursor-pointer text-[10px] ${
              (comment.reactions?.thumbs_up || []).includes(profile?.id || "")
                ? "bg-blue-950/40 border-blue-800 text-blue-400 font-bold"
                : "bg-neutral-900/40 border-neutral-850 text-gray-500 hover:text-gray-300"
            }`}
          >
            👍 {(comment.reactions?.thumbs_up || []).length}
          </button>
          <button
            type="button"
            onClick={() => handleToggleReaction(comment.id, "party")}
            className={`px-2 py-0.5 rounded border flex items-center gap-1 transition-colors cursor-pointer text-[10px] ${
              (comment.reactions?.party || []).includes(profile?.id || "")
                ? "bg-purple-950/40 border-purple-800 text-purple-400 font-bold"
                : "bg-neutral-900/40 border-neutral-850 text-gray-500 hover:text-gray-300"
            }`}
          >
            🎉 {(comment.reactions?.party || []).length}
          </button>
          <button
            type="button"
            onClick={() => handleToggleReaction(comment.id, "heart")}
            className={`px-2 py-0.5 rounded border flex items-center gap-1 transition-colors cursor-pointer text-[10px] ${
              (comment.reactions?.heart || []).includes(profile?.id || "")
                ? "bg-red-955/20 border-red-800 text-red-400 font-bold"
                : "bg-neutral-900/40 border-neutral-850 text-gray-500 hover:text-gray-300"
            }`}
          >
            ❤️ {(comment.reactions?.heart || []).length}
          </button>
        </div>

        {(profile?.role === "teacher" || profile?.role === "admin") && (
          <button
            type="button"
            onClick={() => handleMarkBestAnswer(comment.id, isSolutionComment(comment))}
            className={`text-[9px] font-bold px-2 py-0.5 rounded border transition cursor-pointer ${
              isSolutionComment(comment)
                ? "bg-emerald-955 border-emerald-800 text-emerald-400"
                : "bg-neutral-900/50 border-neutral-850 text-gray-400 hover:text-white"
            }`}
          >
            {isSolutionComment(comment) ? "Desmarcar Solución" : "Marcar como Solución"}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="mt-4 border-t border-neutral-800/80 pt-4 space-y-4 text-left">
      <h6 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Foro de Consultas / Avisos</h6>

      {/* Comments List */}
      <div ref={listRef} className="space-y-3 max-h-60 overflow-y-auto pr-2">
        {virtualized ? (
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((item) => (
              <div key={filteredComments[item.index].id} data-index={item.index} ref={virtualizer.measureElement}
                className="pb-3" style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${item.start}px)` }}>
                {renderComment(filteredComments[item.index])}
              </div>
            ))}
          </div>
        ) : filteredComments.map(renderComment)}
        {filteredComments.length === 0 && (
          <p className="text-xs text-gray-500 italic text-center py-2">No hay consultas en esta clase todavía.</p>
        )}
      </div>

      {/* Add Comment Input */}
      <div className="flex gap-2">
        <label htmlFor={`newCommentText-${classNumber}`} className="sr-only">
          Nuevo comentario
        </label>
        <input
          id={`newCommentText-${classNumber}`}
          type="text"
          value={newCommentText}
          onChange={(e) => setNewCommentText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAddComment();
            }
          }}
          placeholder="Escribe una respuesta o aviso..."
          className="flex-1 bg-neutral-950 border border-neutral-850 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-sans"
        />
        <button
          type="button"
          onClick={handleAddComment}
          disabled={submitting}
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-1.5 rounded-xl text-xs transition cursor-pointer disabled:opacity-50 font-sans"
        >
          {submitting ? "..." : "Responder"}
        </button>
      </div>
    </div>
  );
}
