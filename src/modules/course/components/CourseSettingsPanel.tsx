
"use client";
import React from "react";

import { copyToClipboard } from "@/lib/clipboard";
import { api } from "@/lib/api";
import GmailIntegrationCard from "@/modules/mail/components/GmailIntegrationCard";
import MoodleIntegrationPanel from "@/modules/moodle/components/MoodleIntegrationPanel";

export function CourseSettingsPanel(props: any) {
  // Destructure everything from props to make it easy for now
  const {
    profile, selectedCourse, setSelectedCourse, setApiLoading, showToast, 
    teacherGithubToken, setTeacherGithubToken, teacherMoodleEnabled, setTeacherMoodleEnabled,
    teacherExternalCalendars, setTeacherExternalCalendars,
    teacherSchedules, setTeacherSchedules,
    teacherClasses, teacherCommissions, setTeacherCommissions,
    teacherCommissionsMapping, setTeacherCommissionsMapping,
    cloneSourceId, setCloneSourceId, moodleApiUrl, setMoodleApiUrl,
    moodleWsToken, setMoodleWsToken, moodleCourseId, setMoodleCourseId,
    showCsvEndpoint, setShowCsvEndpoint, showCsvGradingEndpoint, setShowCsvGradingEndpoint,
    scheduleDay, setScheduleDay, scheduleTime, setScheduleTime, scheduleType, setScheduleType,
    otherTeacherCourses, setCourseSubTab, courseSubTab, newCommissionInput, setNewCommissionInput, teacherCoverText, setTeacherCoverText, teacherStartDate, setTeacherStartDate, teacherDuration, setTeacherDuration,
    gmailStatus, handleStartGmailAuth, handleDisconnectGmail, handleSendTestGmail, courseTeachers,
    handleAddSchedule, handleRemoveSchedule, handleSaveTeacherSettings, handleExportMoodleXml, handleSyncMoodleRoster, handleCloneCourseConfig
  } = props;

  return (
    <>
                  {courseSubTab === "settings" && (profile?.role === "teacher" || profile?.role === "admin") && (
              <div className="space-y-6">
                <form onSubmit={handleSaveTeacherSettings} className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 space-y-4">
                  <h3 className="text-lg font-bold">Datos Generales</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1">Fecha de Inicio de Cursada</label>
                      <input
                        type="date"
                        value={teacherStartDate}
                        onChange={(e: any) => setTeacherStartDate(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1">Duración en Semanas</label>
                      <input
                        type="number"
                        value={teacherDuration}
                        onChange={(e: any) => setTeacherDuration(e.target.value)}
                        placeholder="Ej: 16"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-semibold text-gray-400">GitHub Personal Access Token (PAT)</label>
                      {teacherGithubToken && (
                        <span className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/30 px-2 py-0.5 rounded font-mono font-bold">
                          ✓ Token Cargado (••••••••)
                        </span>
                      )}
                    </div>
                    <input
                      type="password"
                      value={teacherGithubToken}
                      onChange={(e: any) => setTeacherGithubToken(e.target.value)}
                      placeholder={teacherGithubToken ? "••••••••••••••••" : "ghp_..."}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono"
                    />
                    <div className="mt-1 flex items-center justify-between text-[11px]">
                      <span className="text-gray-400">¿Necesitás generar un token?</span>
                      <a
                        href="https://github.com/settings/tokens/new?description=NinjaDojo_PAT&scopes=repo,admin:org,read:user"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 font-semibold flex items-center space-x-1 underline"
                      >
                        <span>🔑 Generar PAT en GitHub con permisos necesarios (repo, admin:org) ↗</span>
                      </a>
                    </div>
                  </div>

                  <GmailIntegrationCard 
                    gmailStatus={gmailStatus}
                    handleStartAuth={handleStartGmailAuth}
                    handleDisconnect={handleDisconnectGmail}
                    handleSendTest={handleSendTestGmail}
                  />

                  <div className="flex items-center space-x-3 bg-neutral-900/50 p-4 rounded-xl border border-neutral-850">
                    <input
                      type="checkbox"
                      id="moodleEnabledCheckbox"
                      checked={teacherMoodleEnabled}
                      onChange={(e: any) => setTeacherMoodleEnabled(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-neutral-950 border-neutral-800 cursor-pointer"
                    />
                    <label htmlFor="moodleEnabledCheckbox" className="text-xs font-semibold text-gray-300 cursor-pointer select-none">
                      🔌 Integración con Moodle Habilitada (LTI 1.3 & AGS Grade Sync)
                    </label>
                  </div>

                  {teacherMoodleEnabled && (
                    <MoodleIntegrationPanel
                      courseId={selectedCourse.id || selectedCourse.course?.id}
                      courseName={selectedCourse.name || "Cátedra"}
                      api={api}
                      onExportXml={handleExportMoodleXml}
                      onSyncRoster={handleSyncMoodleRoster}
                      moodleApiUrl={moodleApiUrl}
                      setMoodleApiUrl={setMoodleApiUrl}
                      moodleWsToken={moodleWsToken}
                      setMoodleWsToken={setMoodleWsToken}
                      moodleCourseId={moodleCourseId}
                      setMoodleCourseId={setMoodleCourseId}
                    />
                  )}

                  {teacherMoodleEnabled && (
                    <div className="bg-neutral-900/60 p-4 rounded-xl border border-neutral-850 space-y-2">
                      <span className="text-xs font-bold text-gray-300 block">📅 URL del Calendario de la Cátedra (Para Moodle)</span>
                      <p className="text-[10px] text-gray-400">
                        Copia esta URL y agrégala en el Calendario de Moodle como una suscripción externa (URL) para sincronizar las clases automáticamente:
                      </p>
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          readOnly
                          value={typeof window !== "undefined" ? `${window.location.origin}/api/calendar?id=${selectedCourse.id || selectedCourse.course?.id}` : `https://dojo--jutsu-classroom-mrtin.us-east4.hosted.app/api/calendar?id=${selectedCourse.id || selectedCourse.course?.id}`}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-gray-300 select-all font-mono"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            const cid = selectedCourse.id || selectedCourse.course?.id || "";
                            const url = typeof window !== "undefined" ? `${window.location.origin}/api/calendar?id=${cid}` : `https://dojo--jutsu-classroom-mrtin.us-east4.hosted.app/api/calendar?id=${cid}`;
                            const ok = await copyToClipboard(url);
                            showToast(ok ? "¡Enlace de calendario copiado con éxito al portapapeles!" : "No se pudo copiar automáticamente.", "success");
                          }}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          Copiar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const cid = selectedCourse.id || selectedCourse.course?.id || "";
                            const feedUrl = typeof window !== "undefined" ? `${window.location.origin}/api/calendar?id=${cid}` : `https://dojo--jutsu-classroom-mrtin.us-east4.hosted.app/api/calendar?id=${cid}`;
                            window.open(`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(feedUrl)}`, "_blank");
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-1 whitespace-nowrap"
                          title="Añadir suscripción a Google Calendar"
                        >
                          <span>📅 Google Calendar</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">Calendarios Externos ICS (URLs separadas por comas)</label>
                    <input
                      type="text"
                      value={teacherExternalCalendars}
                      onChange={(e: any) => setTeacherExternalCalendars(e.target.value)}
                      placeholder="https://example.com/calendar.ics"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-semibold text-gray-400">Texto de Portada</label>
                      {teacherCoverText && (
                        <span className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/30 px-2 py-0.5 rounded font-mono font-bold">
                          ✓ Portada Cargada ({teacherCoverText.length} caracteres)
                        </span>
                      )}
                    </div>
                    <textarea
                      value={teacherCoverText}
                      onChange={(e: any) => setTeacherCoverText(e.target.value)}
                      placeholder="Detalles sobre la cátedra..."
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white h-20"
                    />
                  </div>

                  {/* Schedules creation */}
                  <div className="border-t border-neutral-800/60 pt-4 space-y-4">
                    <h4 className="font-bold text-xs text-gray-400 uppercase tracking-wider">Horarios Semanales recurrentes</h4>
                    
                    <div className="flex flex-wrap gap-2 items-end bg-neutral-950 p-4 rounded-xl border border-neutral-850">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Día</label>
                        <select
                          value={scheduleDay}
                          onChange={(e: any) => setScheduleDay(e.target.value)}
                          className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none"
                        >
                          <option value="Lunes">Lunes</option>
                          <option value="Martes">Martes</option>
                          <option value="Miércoles">Miércoles</option>
                          <option value="Jueves">Jueves</option>
                          <option value="Viernes">Viernes</option>
                          <option value="Sábado">Sábado</option>
                          <option value="Domingo">Domingo</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Hora Inicio</label>
                        <input
                          type="time"
                          value={scheduleTime}
                          onChange={(e: any) => setScheduleTime(e.target.value)}
                          className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Tipo clase</label>
                        <select
                          value={scheduleType}
                          onChange={(e: any) => setScheduleType(e.target.value)}
                          className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none"
                        >
                          <option value="Teoría">Teoría</option>
                          <option value="Práctica">Práctica</option>
                          <option value="Laboratorio">Laboratorio</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddSchedule}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition"
                      >
                        Añadir Horario
                      </button>
                    </div>

                    <div className="space-y-2">
                      {teacherSchedules.map((s: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center bg-neutral-950 border border-neutral-850 p-3 rounded-lg text-xs">
                          <span><strong>{s.day}</strong> a las <strong>{s.time}</strong> ({s.type})</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSchedule(idx)}
                            className="bg-red-950/40 text-red-400 hover:bg-red-900/40 border border-red-800/45 px-2.5 py-1 rounded transition"
                          >
                            Eliminar
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Co-Docencia Commissions Mapping */}
                  <div className="border-t border-neutral-800/60 pt-4 space-y-4">
                    <h4 className="font-bold text-xs text-gray-400 uppercase tracking-wider">Co-Docencia & Responsables de Comisión</h4>
                    <p className="text-[10px] text-gray-550 leading-normal">
                      Asigna un docente responsable a cada comisión. Esto ayuda a coordinar las tareas, asistencia y consultas específicas.
                    </p>

                    <div className="flex gap-2 max-w-md">
                      <input
                        type="text"
                        placeholder="Ej. Comisión E o Comisión 1"
                        value={newCommissionInput}
                        onChange={(e: any) => setNewCommissionInput(e.target.value)}
                        className="flex-1 bg-neutral-950 border border-neutral-850 rounded-xl px-3 py-2 text-xs focus:outline-none text-white font-sans"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const name = newCommissionInput.trim();
                          if (!name) return;
                          if (teacherCommissions.includes(name)) {
                            showToast("Esa comisión ya existe.", "success");
                            return;
                          }
                          setTeacherCommissions((prev: any) => [...prev, name]);
                          setNewCommissionInput("");
                        }}
                        className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-bold transition font-sans cursor-pointer"
                      >
                        Agregar Comisión
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {teacherCommissions.map((comm: any) => (
                        <div key={comm} className="flex justify-between items-center bg-neutral-950/60 border border-neutral-850 p-3 rounded-xl gap-2">
                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`¿Estás seguro de eliminar la ${comm}?`)) {
                                  setTeacherCommissions((prev: any) => prev.filter((c: any) => c !== comm));
                                  setTeacherCommissionsMapping((prev: any) => {
                                    const copy = { ...prev };
                                    delete copy[comm];
                                    return copy;
                                  });
                                }
                              }}
                              className="text-red-500 hover:text-red-400 p-1 text-xs cursor-pointer"
                              title="Eliminar comisión"
                              aria-label="Eliminar comisión"
                            >
                              🗑️
                            </button>
                            <span className="text-xs font-bold text-white font-sans">{comm}</span>
                          </div>
                          <select
                            value={teacherCommissionsMapping[comm] || ""}
                            onChange={(e: any) => {
                              const val = e.target.value;
                              setTeacherCommissionsMapping((prev: any) => ({
                                ...prev,
                                [comm]: val
                              }));
                            }}
                            className="bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-xs focus:outline-none text-gray-300 font-sans max-w-[180px]"
                          >
                            <option value="">Sin responsable asignado</option>
                            {courseTeachers.map((ct: any) => (
                              <option key={ct.teacher_id} value={ct.teacher_id}>
                                {ct.profiles?.full_name || ct.profiles?.email || "Docente"}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition"
                  >
                    Guardar Configuración
                  </button>
                </form>

                {/* CSV grading synchronization (NORMALLY COLLAPSED/HIDDEN) */}
                <div className="bg-neutral-900/60 p-5 rounded-2xl border border-neutral-800 space-y-3">
                  <button
                    type="button"
                    onClick={() => setShowCsvGradingEndpoint(!showCsvGradingEndpoint)}
                    className="w-full flex justify-between items-center text-sm font-bold text-gray-200 hover:text-white transition cursor-pointer select-none"
                  >
                    <span>📊 Sincronización de Planilla de Notas (CSV / Google Sheets)</span>
                    <span className="text-[10px] bg-neutral-950 px-3 py-1 rounded-lg border border-neutral-800 text-gray-400 font-semibold">
                      {showCsvGradingEndpoint ? "▲ Ocultar URL" : "▼ Mostrar URL"}
                    </span>
                  </button>

                  {showCsvGradingEndpoint && (
                    <div className="pt-3 space-y-3 border-t border-neutral-800/80 animate-in fade-in duration-200">
                      <p className="text-xs text-gray-400 leading-relaxed">
                        Usa esta URL para sincronizar las notas de tus alumnos de esta cátedra directamente en tu planilla externa:
                      </p>
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          readOnly
                          value={`https://us-central1-jutsu-classroom-mrtin.cloudfunctions.net/exportGradesCsv?courseId=${selectedCourse.id || selectedCourse.course?.id}&token=${selectedCourse.sync_secret || "TOKEN"}`}
                          className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-4 py-2.5 text-xs text-amber-400 font-mono select-all"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            const url = `https://us-central1-jutsu-classroom-mrtin.cloudfunctions.net/exportGradesCsv?courseId=${selectedCourse.id || selectedCourse.course?.id}&token=${selectedCourse.sync_secret || "TOKEN"}`;
                            const ok = await copyToClipboard(url);
                            showToast(ok ? "¡URL del Endpoint CSV de Notas copiada al portapapeles con éxito!" : "No se pudo copiar la URL.", "success");
                          }}
                          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap"
                        >
                          Copiar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Clone course settings from another course */}
                {otherTeacherCourses.length > 0 && (
                  <div className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 space-y-4">
                    <h3 className="text-lg font-bold">Clonar Ajustes de Otra Cátedra</h3>
                    <div className="flex gap-2">
                      <select
                        value={cloneSourceId}
                        onChange={(e: any) => setCloneSourceId(e.target.value)}
                        className="bg-neutral-950 border border-neutral-850 rounded-xl px-4 py-2.5 text-xs text-white flex-1 focus:outline-none"
                      >
                        <option value="">Selecciona cátedra origen...</option>
                        {otherTeacherCourses.map((c: any) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleCloneCourseConfig}
                        disabled={!cloneSourceId}
                        className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition disabled:opacity-50"
                      >
                        Clonar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

    </>
  );
}
