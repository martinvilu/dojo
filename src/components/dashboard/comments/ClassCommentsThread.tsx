import React, { useState } from "react";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  arrayRemove,
  arrayUnion,
  query,
  where,
  getDocs,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/clientApp";

interface CommentReaction {
  thumbs_up?: string[];
  party?: string[];
  heart?: string[];
}

interface CommentItem {
  id: string;
  classNumber: number;
  user_id: string;
  user_name: string;
  user_role: string;
  content: string;
  is_best_answer?: boolean;
  reactions?: CommentReaction;
  created_at?: any;
}

interface ClassCommentsThreadProps {
  classNumber: number;
  courseId: string;
  courseComments: CommentItem[];
  profile: {
    id: string;
    full_name?: string;
    email: string;
    role: "student" | "teacher" | "admin" | "tutor";
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
        created_at: serverTimestamp(),
      });
      setNewCommentText("");
    } catch (err: any) {
      alert("Error al enviar comentario: " + err.message);
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
      const currentReactions = data.reactions?.[reactionType] || [];
      const hasReacted = currentReactions.includes(profile.id);

      await updateDoc(commentRef, {
        [`reactions.${reactionType}`]: hasReacted
          ? arrayRemove(profile.id)
          : arrayUnion(profile.id),
      });
    } catch (err: any) {
      console.error("Error toggling reaction:", err);
    }
  };

  const handleMarkBestAnswer = async (commentId: string, currentStatus: boolean) => {
    if (!profile) return;
    if (profile.role !== "teacher" && profile.role !== "admin") return;

    try {
      const q = query(
        collection(db, "courses", courseId, "class_comments"),
        where("classNumber", "==", classNumber),
        where("is_best_answer", "==", true)
      );
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach((d) => {
        batch.update(d.ref, { is_best_answer: false });
      });

      const targetRef = doc(db, "courses", courseId, "class_comments", commentId);
      batch.update(targetRef, { is_best_answer: !currentStatus });

      await batch.commit();
    } catch (err: any) {
      alert("Error al marcar mejor respuesta: " + err.message);
    }
  };

  const filteredComments = courseComments.filter((c) => c.classNumber === classNumber);

  return (
    <div className="mt-4 border-t border-neutral-800/80 pt-4 space-y-4 text-left">
      <h6 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Foro de Consultas / Avisos</h6>

      {/* Comments List */}
      <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
        {filteredComments.map((comment) => (
          <div
            key={comment.id}
            className={`p-3.5 rounded-xl space-y-2 border transition ${
              comment.is_best_answer
                ? "border-emerald-500 bg-emerald-950/15"
                : "bg-neutral-955 border-neutral-850"
            }`}
          >
            <div className="flex justify-between items-center text-[10px]">
              <div className="flex items-center space-x-2">
                <span className={`font-bold ${comment.user_role === "teacher" ? "text-amber-400" : "text-blue-400"}`}>
                  {comment.user_name} ({comment.user_role === "teacher" ? "Profesor" : "Estudiante"})
                </span>
                {comment.is_best_answer && (
                  <span className="px-2 py-0.5 rounded bg-emerald-955 border border-emerald-800 text-emerald-400 text-[8px] font-bold uppercase tracking-wider">
                    ✔️ Solución
                  </span>
                )}
              </div>
              <span className="text-gray-500">
                {comment.created_at?.toDate
                  ? comment.created_at.toDate().toLocaleString("es-AR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Enviando..."}
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
                  onClick={() => handleMarkBestAnswer(comment.id, comment.is_best_answer || false)}
                  className={`text-[9px] font-bold px-2 py-0.5 rounded border transition cursor-pointer ${
                    comment.is_best_answer
                      ? "bg-emerald-950/50 border-emerald-800 text-emerald-400"
                      : "bg-neutral-900/50 border-neutral-850 text-gray-400 hover:text-white"
                  }`}
                >
                  {comment.is_best_answer ? "Desmarcar Solución" : "Marcar como Solución"}
                </button>
              )}
            </div>
          </div>
        ))}
        {filteredComments.length === 0 && (
          <p className="text-xs text-gray-500 italic text-center py-2">No hay consultas en esta clase todavía.</p>
        )}
      </div>

      {/* Add Comment Input */}
      <div className="flex gap-2">
        <input
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
