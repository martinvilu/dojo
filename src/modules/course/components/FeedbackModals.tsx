"use client";
import React from "react";

export function FeedbackModals(props: any) {
  const {
    activeFeedbackClass,
    setActiveFeedbackClass,
    loadingFeedback,
    feedbackRating,
    setFeedbackRating,
    feedbackUnderstanding,
    setFeedbackUnderstanding,
    feedbackComment,
    setFeedbackComment,
    handleSubmitFeedback,
    viewingFeedbackClass,
    setViewingFeedbackClass,
    feedbackStats
  } = props;

  return (
    <>
      {/* MODAL: SUBMIT ANONYMOUS FEEDBACK (STUDENT) */}
      {activeFeedbackClass !== null && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-md w-full min-w-[280px] sm:min-w-[420px] shrink-0 mx-auto p-6 space-y-6 shadow-2xl relative z-10 max-h-[90vh] overflow-y-auto">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <span>✍️ Feedback Anónimo</span>
                <span className="text-xs bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded-md font-mono">
                  Clase {activeFeedbackClass}
                </span>
              </h3>
              <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
                Tu opinión es completamente anónima. El sistema genera un identificador único encriptado para evitar duplicados sin almacenar tu identidad.
              </p>
            </div>

            {loadingFeedback ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-2">
                <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-[10px] text-gray-550 font-semibold">Cargando datos...</span>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Stars Rating */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest font-sans">¿Qué te pareció la clase?</label>
                  <div className="flex space-x-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFeedbackRating(star)}
                        className={`text-2xl transition-transform hover:scale-125 cursor-pointer focus:outline-none ${
                          star <= feedbackRating ? "text-amber-400" : "text-neutral-750"
                        }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                {/* Understanding */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest font-sans">Nivel de Comprensión</label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { val: "Entendí todo", style: "border-emerald-800/40 text-emerald-400 bg-emerald-950/20" },
                      { val: "Entendí la mayor parte", style: "border-blue-800/40 text-blue-400 bg-blue-955/20" },
                      { val: "Tengo dudas", style: "border-amber-800/40 text-amber-400 bg-amber-955/20" },
                      { val: "No entendí nada", style: "border-red-800/40 text-red-400 bg-red-950/20" }
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setFeedbackUnderstanding(opt.val)}
                        className={`p-2.5 rounded-xl border text-center transition cursor-pointer font-semibold ${
                          feedbackUnderstanding === opt.val
                            ? opt.style + " border-opacity-100 ring-1 ring-emerald-500"
                            : "border-neutral-800 text-gray-400 bg-neutral-950/40 hover:text-white"
                        }`}
                      >
                        {opt.val}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Optional Comment */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest font-sans">Comentarios / Sugerencias (Opcional)</label>
                  <textarea
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    placeholder="Escribe sugerencias constructivas sobre el ritmo, temario o explicaciones de la clase..."
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 h-20 resize-none font-sans"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveFeedbackClass(null)}
                    className="flex-1 py-2.5 bg-neutral-800 hover:bg-neutral-750 text-gray-300 text-xs font-bold rounded-xl transition border border-neutral-700 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitFeedback}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Enviar Feedback
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: VIEW ANONYMOUS FEEDBACK STATS (TEACHER) */}
      {viewingFeedbackClass !== null && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto font-sans">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-lg w-full min-w-[280px] sm:min-w-[480px] shrink-0 mx-auto p-6 space-y-6 shadow-2xl relative z-10 max-h-[90vh] flex flex-col">
            <div className="border-b border-neutral-800 pb-3 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <span>📊 Feedback de Alumnos</span>
                <span className="text-xs bg-blue-955 text-blue-300 border border-blue-800 px-2 py-0.5 rounded-md font-mono">
                  Clase {viewingFeedbackClass}
                </span>
              </h3>
              <button
                onClick={() => setViewingFeedbackClass(null)}
                className="text-gray-500 hover:text-white transition font-bold"
              >
                ✕
              </button>
            </div>

            {loadingFeedback ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-2 flex-1">
                <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-[10px] text-gray-550 font-semibold animate-pulse">Analizando respuestas anónimas...</span>
              </div>
            ) : feedbackStats ? (
              <div className="space-y-6 overflow-y-auto flex-1 pr-1.5 custom-scrollbar text-xs">
                {/* Summary Score Card */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-neutral-950/60 border border-neutral-850 p-4 rounded-2xl text-center space-y-1.5">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-sans">Valoración Promedio</span>
                    <div className="text-2xl font-black text-amber-400">
                      {feedbackStats.avgRating.toFixed(1)} <span className="text-lg">★</span>
                    </div>
                  </div>
                  <div className="bg-neutral-950/60 border border-neutral-850 p-4 rounded-2xl text-center space-y-1.5">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-sans">Encuestas Completadas</span>
                    <div className="text-2xl font-black text-white">
                      {feedbackStats.count} <span className="text-xs text-gray-500 font-semibold font-sans">alumnos</span>
                    </div>
                  </div>
                </div>

                {/* Understanding Distribution */}
                <div className="bg-neutral-950/40 border border-neutral-850 p-4 rounded-2xl space-y-3">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-sans">Nivel de Comprensión General</h4>
                  <div className="space-y-2">
                    {[
                      { label: "Entendí todo", key: "Entendí todo", barBg: "bg-emerald-500", textClass: "text-emerald-400" },
                      { label: "Entendí la mayor parte", key: "Entendí la mayor parte", barBg: "bg-blue-500", textClass: "text-blue-400" },
                      { label: "Tengo dudas", key: "Tengo dudas", barBg: "bg-amber-500", textClass: "text-amber-400" },
                      { label: "No entendí nada", key: "No entendí nada", barBg: "bg-red-500", textClass: "text-red-400" }
                    ].map((row) => {
                      const count = feedbackStats.understandingDist[row.key] || 0;
                      const pct = feedbackStats.count > 0 ? (count / feedbackStats.count) * 100 : 0;
                      return (
                        <div key={row.key} className="space-y-1">
                          <div className="flex justify-between text-[10px] font-semibold">
                            <span className={row.textClass}>{row.label}</span>
                            <span className="text-gray-500">{count} ({pct.toFixed(0)}%)</span>
                          </div>
                          <div className="w-full h-1.5 bg-neutral-950 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${row.barBg}`} style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Written Comments */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-sans">Sugerencias y Comentarios Escritos</h4>
                  <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                    {feedbackStats.comments.map((cmt: any, cIdx: number) => (
                      <div key={cIdx} className="bg-neutral-950/80 border border-neutral-850 p-3 rounded-xl text-xs text-gray-300 leading-relaxed italic">
                        "{cmt}"
                      </div>
                    ))}
                    {feedbackStats.comments.length === 0 && (
                      <p className="text-xs text-gray-500 italic text-center py-4 bg-neutral-950/20 rounded-xl border border-neutral-850 border-dashed">
                        No se registraron comentarios escritos para esta clase.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-center text-gray-500 italic py-6">No se pudieron cargar las estadísticas.</p>
            )}

            <div className="border-t border-neutral-800 pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingFeedbackClass(null)}
                className="px-5 py-2 bg-neutral-800 hover:bg-neutral-750 text-gray-300 text-xs font-bold rounded-xl transition border border-neutral-700 cursor-pointer"
              >
                Cerrar Panel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
