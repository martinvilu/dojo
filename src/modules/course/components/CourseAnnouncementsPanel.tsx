
"use client";
import React from "react";

export function CourseAnnouncementsPanel(props: any) {
  const {
    profile, announcements, newAnnouncementMessage, setNewAnnouncementMessage,
    handleCreateAnnouncement, handleAcknowledgeAnnouncement, courseSubTab, marked,
    handleToggleAcks, visibleAcksId, announcementAcks
  } = props;
  return (
    <>
                  {courseSubTab === "announcements" && (
              <div className="space-y-6">
                {profile?.role === "teacher" && (
                  /* TEACHER SEND ANNOUNCEMENT */
                  <form onSubmit={handleCreateAnnouncement} className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 space-y-4">
                    <h4 className="font-bold text-sm text-gray-400 uppercase tracking-wider">Publicar Aviso a Alumnos</h4>
                    <div>
                      <textarea
                        value={newAnnouncementMessage}
                        onChange={(e) => setNewAnnouncementMessage(e.target.value)}
                        placeholder="Mensaje o temario del aviso (Soporta Markdown)..."
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-xs focus:outline-none text-white h-24 font-sans"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition"
                    >
                      Enviar Aviso
                    </button>
                  </form>
                )}

                {/* Announcements List */}
                <div className="space-y-4">
                  {announcements.map((a: any) => {
                    const dateStr = a.created_at
                      ? new Date(a.created_at._seconds * 1000).toLocaleString("es-AR")
                      : "Reciente";
                    return (
                      <div key={a.id} className="p-6 bg-neutral-900/40 border border-neutral-800 rounded-2xl space-y-4">
                        <div className="flex justify-between items-center border-b border-neutral-850 pb-2">
                          <span className="text-xs font-bold text-blue-400">Aviso General</span>
                          <span className="text-[10px] text-gray-500 font-mono">{dateStr}</span>
                        </div>
                        <div 
                          className="text-xs text-gray-300 leading-relaxed font-sans markdown-body"
                          dangerouslySetInnerHTML={{ __html: marked.parse(a.message || "") }}
                        />
                        
                        {profile?.role === "student" && (
                          <div className="flex justify-end pt-3 border-t border-neutral-850">
                            {a.acknowledged ? (
                              <span className="text-[11px] text-green-400 font-semibold flex items-center space-x-1">
                                <span>Acuse de recepción confirmado ✓</span>
                              </span>
                            ) : (
                              <button
                                onClick={() => handleAcknowledgeAnnouncement(a.id)}
                                className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 rounded-lg text-[10px] font-bold text-gray-300 transition cursor-pointer"
                              >
                                Confirmar Recepción
                              </button>
                            )}
                          </div>
                        )}

                        {(profile?.role === "teacher" || profile?.role === "admin") && (
                          <div className="pt-3 border-t border-neutral-850 space-y-3">
                            <div className="flex justify-between items-center">
                              <button
                                onClick={() => handleToggleAcks(a.id)}
                                className="text-[10px] text-blue-400 hover:text-blue-300 font-bold underline transition"
                              >
                                {visibleAcksId === a.id ? "Ocultar Acuses" : "Ver Acuses de Recepción"}
                              </button>
                            </div>
                            {visibleAcksId === a.id && (
                              <div className="bg-neutral-950/60 p-4 rounded-xl border border-neutral-850 space-y-2">
                                <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Leído por:</h5>
                                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                  {announcementAcks.map((ack: any) => {
                                    const ackDate = ack.acknowledged_at
                                      ? new Date(ack.acknowledged_at._seconds * 1000).toLocaleString("es-AR")
                                      : "Reciente";
                                    return (
                                      <div key={ack.student_id} className="text-xs flex justify-between text-gray-300">
                                        <span>{ack.profile?.full_name || "Estudiante"} ({ack.profile?.email || "-"})</span>
                                        <span className="text-gray-500 font-mono text-[10px]">{ackDate}</span>
                                      </div>
                                    );
                                  })}
                                  {announcementAcks.length === 0 && (
                                    <p className="text-[11px] text-gray-500 italic">Nadie ha confirmado recepción aún.</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {announcements.length === 0 && (
                    <p className="text-gray-550 text-sm">No hay avisos publicados en esta cátedra.</p>
                  )}
                </div>
              </div>
            )}

            {/* SUBTAB 4. AJUSTES CÁTEDRA */}
    </>
  );
}
