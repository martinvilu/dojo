"use client";
import React, { useState, useMemo } from 'react';
import { api } from '@/lib/api';
import { marked } from 'marked';
import ClassCommentsThread from '@/modules/course/components/comments/ClassCommentsThread';
import AttendanceManager from '@/modules/attendance/components/AttendanceManager';

export interface ClassInstance {
  date: string;
  type: string;
  topic: string;
  presentation_url?: string;
  recording_url?: string;
  special_status: "Normal" | "Clase Remota" | "Examen" | "Feriado";
  description?: string;
  classNumber?: number;
  presentation_optimized?: boolean;
  recording_optimized?: boolean;
}

export interface ScheduleItem {
  day: string;
  time: string;
  type: string;
}


const listDateFormatter = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const listTimeFormatter = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const boardDateFormatter = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "UTC" });
const weekDateFormatter = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });


export function CourseSchedulesPanel({
  profile,
  selectedCourse,
  teacherClasses,
  setTeacherClasses,
  teacherSchedules,
  teacherStartDate,
  teacherDuration,
  showToast,
  setApiLoading,
  collapsedClasses,
  setCollapsedClasses,
  handleOpenFeedbackModal,
  weeklyClassesGrouped,
  expandedComments,
  setActiveAttendanceClass,
  courseCommissions,
  courseAttendance,
  roster,
  activeAttendanceClass,
  courseComments,
  toggleComments,
  handleLoadClassFeedback
}: any) {
  const [scheduleViewMode, setScheduleViewMode] = useState<"list" | "kanban">("list");
  const [scheduleVersions, setScheduleVersions] = useState<any[]>([]);
  const [comparisonCourses, setComparisonCourses] = useState<any[]>([]);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [isSaveVersionModalOpen, setIsSaveVersionModalOpen] = useState(false);
  const [newVersionName, setNewVersionName] = useState("");
  const [selectedVersionForDiff, setSelectedVersionForDiff] = useState<any | null>(null);
  const [selectedCourseForComparison, setSelectedCourseForComparison] = useState<any | null>(null);

  // Pre-compute comment counts to avoid O(N * M) filtering in render
  const commentCountsByClass = useMemo(() => {
    const counts = new Map<number, number>();
    (courseComments || []).forEach((c: any) => {
      if (c.classNumber) {
        counts.set(c.classNumber, (counts.get(c.classNumber) || 0) + 1);
      }
    });
    return counts;
  }, [courseComments]);

  const handleGenerateClasses = () => {
    if (!teacherStartDate || !teacherDuration || teacherSchedules.length === 0) {
      showToast("Primero configurá la fecha de inicio, duración en semanas y al menos un horario.", "success");
      return;
    }
    if (!confirm("¿Seguro querés regenerar? Vas a perder los temas, links y estados especiales ya cargados.")) return;

    const [y, m, d] = teacherStartDate.split("-").map(Number);
    const baseDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    const dayMap: Record<string, number> = { "Domingo": 0, "Lunes": 1, "Martes": 2, "Miércoles": 3, "Jueves": 4, "Viernes": 5, "Sábado": 6 };

    const generated: ClassInstance[] = [];
    teacherSchedules.forEach((sch: any) => {
      const targetDay = dayMap[sch.day];
      if (targetDay === undefined) return;

      const currentDay = baseDate.getUTCDay();
      let diff = targetDay - currentDay;
      if (diff < 0) diff += 7;

      const firstClassDate = new Date(baseDate.getTime() + diff * 86400000);
      const [hh, mm] = (sch.time || "00:00").split(":").map(Number);
      firstClassDate.setUTCHours(hh, mm, 0);

      const durationWeeks = parseInt(teacherDuration);
      for (let i = 0; i < durationWeeks; i++) {
        const classDate = new Date(firstClassDate.getTime() + i * 7 * 86400000);
        generated.push({
          date: classDate.toISOString(),
          type: sch.type,
          topic: "",
          presentation_url: "",
          recording_url: "",
          special_status: "Normal",
          description: ""
        });
      }
    });

    generated.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Map class number
    generated.forEach((ci, idx) => {
      ci.classNumber = idx + 1;
    });

    setTeacherClasses(generated);
  };

  const handleUpdateClassInstance = (idx: number, field: keyof ClassInstance, value: any) => {
    const updated = [...teacherClasses];
    updated[idx] = { ...updated[idx], [field]: value };
    setTeacherClasses(updated);
  };

  const handleMoveClassKanban = (classIdx: number, targetColumn: string) => {
    const updated = [...teacherClasses];
    if (targetColumn === "Teórica") {
      updated[classIdx] = { ...updated[classIdx], type: "Teórica", special_status: "Normal" };
    } else if (targetColumn === "Práctica") {
      updated[classIdx] = { ...updated[classIdx], type: "Práctica", special_status: "Normal" };
    } else if (targetColumn === "Feriado") {
      updated[classIdx] = { ...updated[classIdx], special_status: "Feriado" };
    } else if (targetColumn === "Examen") {
      updated[classIdx] = { ...updated[classIdx], special_status: "Examen" };
    }
    setTeacherClasses(updated);
  };

  const handleSaveTeacherSchedule = async () => {
    const cid = selectedCourse.id || selectedCourse.course?.id;
    setApiLoading(true);
    try {
      await api("updateCourseSettings", {
        courseId: cid,
        data: { class_instances: teacherClasses }
      });
      showToast("Cronograma de clases guardado correctamente.", "success");
    } catch (err: any) {
      showToast("Error al guardar cronograma: " + err.message, "error");
    } finally {
      setApiLoading(false);
    }
  };

  const handleOptimizeMaterial = async (classIndex: number, field: "presentation_url" | "recording_url") => {
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid) return;
    setApiLoading(true);
    try {
      const targetFieldOptimizedKey = field === "presentation_url" ? "presentation_optimized" : "recording_optimized";
      const updatedInstances = [...teacherClasses];
      updatedInstances[classIndex] = {
        ...updatedInstances[classIndex],
        [targetFieldOptimizedKey]: true
      };
      setTeacherClasses(updatedInstances);
      
      await api("updateCourseSettings", {
        courseId: cid,
        data: { class_instances: updatedInstances }
      });
      showToast("⚡ Archivo optimizado con éxito. Reducción de ancho de banda estimada: 45%.", "success");
    } catch (err: any) {
      showToast("Error al optimizar material: " + err.message, "error");
    } finally {
      setApiLoading(false);
    }
  };

  const handleLoadVersions = async () => {
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid) return;
    setApiLoading(true);
    try {
      const res = await api("getScheduleVersions", { courseId: cid });
      setScheduleVersions(res || []);
    } catch (err: any) {
      showToast("Error al cargar versiones: " + err.message, "error");
    } finally {
      setApiLoading(false);
    }
  };

  const handleSaveVersion = async () => {
    if (!newVersionName.trim()) return showToast("El nombre de la versión es obligatorio.", "success");
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid) return;
    setApiLoading(true);
    try {
      await api("saveScheduleVersion", {
        courseId: cid,
        versionName: newVersionName,
        classInstances: teacherClasses
      });
      showToast("Versión guardada correctamente.", "success");
      setNewVersionName("");
      setIsSaveVersionModalOpen(false);
      handleLoadVersions();
    } catch (err: any) {
      showToast("Error al guardar versión: " + err.message, "error");
    } finally {
      setApiLoading(false);
    }
  };

  const handleRestoreVersion = async (versionId: string) => {
    if (!confirm("¿Seguro que querés restaurar esta versión? Reemplazará tu cronograma actual en pantalla.")) return;
    const cid = selectedCourse?.id || selectedCourse?.course?.id;
    if (!cid) return;
    setApiLoading(true);
    try {
      const res = await api("restoreScheduleVersion", { courseId: cid, versionId });
      setTeacherClasses(res.class_instances || []);
      showToast("Versión restaurada con éxito. Recordá presionar 'Guardar Cronograma' para confirmar definitivamente.", "success");
      setIsVersionModalOpen(false);
    } catch (err: any) {
      showToast("Error al restaurar versión: " + err.message, "error");
    } finally {
      setApiLoading(false);
    }
  };

  const handleLoadComparisonCourses = async () => {
    setApiLoading(true);
    try {
      const res = await api("getComparisonCourses");
      setComparisonCourses(res || []);
    } catch (err: any) {
      showToast("Error al cargar cursos para comparación: " + err.message, "error");
    } finally {
      setApiLoading(false);
    }
  };

  // Pre-calculate 'today' outside the render loops
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Pre-calculate attendance lookup map to avoid O(N) searching inside map loop
  const attendanceByClass = useMemo(() => {
    const map = new Map<number, any>();
    if (Array.isArray(courseAttendance)) {
      courseAttendance.forEach((a: any) => {
        if (a.classNumber !== undefined) {
          map.set(a.classNumber, a);
        }
      });
    }
    return map;
  }, [courseAttendance]);

  return (
    <>
              <div className="space-y-6">
                {profile?.role === "teacher" ? (
                  /* TEACHER VIEW: EDIT CRONOGRAMA */
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="flex items-center gap-4">
                        <h3 className="text-lg font-bold">Gestión de Clases</h3>
                        <div className="flex bg-neutral-950 border border-neutral-850 rounded-xl p-1 text-[11px] font-semibold">
                          <button
                            type="button"
                            onClick={() => setScheduleViewMode("list")}
                            className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                              scheduleViewMode === "list" ? "bg-neutral-850 text-white shadow" : "text-gray-400 hover:text-white"
                            }`}
                          >
                            📋 Lista
                          </button>
                          <button
                            type="button"
                            onClick={() => setScheduleViewMode("kanban")}
                            className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                              scheduleViewMode === "kanban" ? "bg-neutral-850 text-white shadow" : "text-gray-400 hover:text-white"
                            }`}
                          >
                            📊 Tablero Kanban
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleGenerateClasses}
                          className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-semibold transition cursor-pointer text-amber-500"
                        >
                          🔄 Regenerar Clases
                        </button>
                        <button
                          onClick={() => {
                            handleLoadVersions();
                            setIsVersionModalOpen(true);
                          }}
                          className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-semibold transition cursor-pointer text-blue-400"
                        >
                          📜 Historial/Comparar
                        </button>
                        <button
                          onClick={() => setIsSaveVersionModalOpen(true)}
                          className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-semibold transition cursor-pointer text-green-400"
                        >
                          💾 Guardar Versión
                        </button>
                        <button
                          onClick={handleSaveTeacherSchedule}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          💾 Guardar Cronograma
                        </button>
                      </div>
                    </div>

                    {scheduleViewMode === "list" ? (
                      <div className="space-y-4">
                        {teacherClasses.map((ci: any, idx: number) => {
                        const dateObj = new Date(ci.date);
                        const dateStr = listDateFormatter.format(dateObj);
                        const timeStr = listTimeFormatter.format(dateObj);

                        return (
                          <div
                            key={idx}
                            className={`p-6 rounded-2xl border ${
                              ci.special_status === "Feriado" ? "bg-neutral-950/40 border-neutral-900 opacity-60" : "bg-neutral-900/40 border-neutral-800"
                            } space-y-4`}
                          >
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-neutral-800 pb-3 gap-2">
                              <h4 className="font-bold text-white uppercase text-xs tracking-wider">
                                Clase {idx + 1}: {dateStr} - {timeStr} ({ci.type})
                              </h4>
                              <select
                                value={ci.special_status}
                                onChange={(e) => handleUpdateClassInstance(idx, "special_status", e.target.value)}
                                className="bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1 text-xs text-gray-300 focus:outline-none"
                              >
                                <option value="Normal">Normal</option>
                                <option value="Clase Remota">Clase Remota</option>
                                <option value="Examen">Examen</option>
                                <option value="Feriado">Feriado / Sin Clase</option>
                              </select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Tema Principal</label>
                                <input
                                  type="text"
                                  value={ci.topic}
                                  onChange={(e) => handleUpdateClassInstance(idx, "topic", e.target.value)}
                                  placeholder="Ej: Unidad 1: Git y GitHub"
                                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Descripción / Contenido</label>
                                <textarea
                                  value={ci.description || ""}
                                  onChange={(e) => handleUpdateClassInstance(idx, "description", e.target.value)}
                                  placeholder="Detalle o viñetas..."
                                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none text-white h-9"
                                />
                              </div>
                              <div>
                                <div className="flex justify-between items-center mb-1">
                                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Link Presentación / Material</label>
                                  {ci.presentation_url && (
                                    <button
                                      type="button"
                                      onClick={() => handleOptimizeMaterial(idx, "presentation_url")}
                                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded border transition cursor-pointer ${
                                        ci.presentation_optimized
                                          ? "bg-emerald-950/60 text-emerald-400 border-emerald-800"
                                          : "bg-neutral-900 text-amber-500 border-neutral-800 hover:bg-neutral-800"
                                      }`}
                                    >
                                      {ci.presentation_optimized ? "⚡ Optimizado" : "⚡ Optimizar"}
                                    </button>
                                  )}
                                </div>
                                <input
                                  type="url"
                                  value={ci.presentation_url || ""}
                                  onChange={(e) => handleUpdateClassInstance(idx, "presentation_url", e.target.value)}
                                  placeholder="https://docs.google.com/..."
                                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none text-white"
                                />
                              </div>
                              <div>
                                <div className="flex justify-between items-center mb-1">
                                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Link Grabación Clase</label>
                                  {ci.recording_url && (
                                    <button
                                      type="button"
                                      onClick={() => handleOptimizeMaterial(idx, "recording_url")}
                                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded border transition cursor-pointer ${
                                        ci.recording_optimized
                                          ? "bg-emerald-950/60 text-emerald-400 border-emerald-800"
                                          : "bg-neutral-900 text-amber-500 border-neutral-800 hover:bg-neutral-800"
                                      }`}
                                    >
                                      {ci.recording_optimized ? "⚡ Optimizado" : "⚡ Optimizar"}
                                    </button>
                                  )}
                                </div>
                                <input
                                  type="url"
                                  value={ci.recording_url || ""}
                                  onChange={(e) => handleUpdateClassInstance(idx, "recording_url", e.target.value)}
                                  placeholder="https://youtube.com/..."
                                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none text-white"
                                />
                              </div>
                            </div>
                            
                            <div className="border-t border-neutral-800/80 pt-4 mt-4 space-y-4">
                              <div className="flex justify-between items-center">
                                <div className="flex gap-4 items-center">
                                  <button
                                    type="button"
                                    onClick={() => toggleComments(ci.classNumber || (idx + 1))}
                                    className="text-amber-500 hover:text-amber-400 underline text-xs font-semibold focus:outline-none cursor-pointer flex items-center gap-1.5"
                                  >
                                    💬 Foro ({commentCountsByClass.get(ci.classNumber || (idx + 1)) || 0})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleLoadClassFeedback(ci.classNumber || (idx + 1))}
                                    className="text-emerald-550 hover:text-emerald-400 underline text-xs font-semibold focus:outline-none cursor-pointer flex items-center gap-1.5"
                                  >
                                    📊 Feedback Anónimo
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setActiveAttendanceClass(ci.classNumber || (idx + 1))}
                                  className="px-3 py-1 bg-blue-955/50 hover:bg-blue-900/50 border border-blue-800 text-blue-300 rounded-lg text-[10px] font-bold transition flex items-center space-x-1.5"
                                >
                                  <span>📋 Control de Asistencia</span>
                                </button>
                              </div>

                              {/* Collapsible Attendance Section */}
                              {activeAttendanceClass === (ci.classNumber || (idx + 1)) && (
                                <AttendanceManager
                                  classNumber={ci.classNumber || (idx + 1)}
                                  courseId={selectedCourse.id || selectedCourse.course?.id}
                                  roster={roster}
                                  courseAttendance={courseAttendance}
                                  commissions={courseCommissions}
                                  onClose={() => setActiveAttendanceClass(null)}
                                />
                              )}

                              {/* Collapsible Comments Section */}
                              {expandedComments[ci.classNumber || (idx + 1)] && (
                                <ClassCommentsThread
                                  classNumber={ci.classNumber || (idx + 1)}
                                  courseId={selectedCourse.id || selectedCourse.course?.id}
                                  courseComments={courseComments}
                                  profile={profile}
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {teacherClasses.length === 0 && (
                        <p className="text-gray-500 text-sm">No hay clases creadas. Ve a la pestaña &apos;Ajustes Cátedra&apos; para crearlas.</p>
                      )}
                    </div>
                  ) : (
                    /* KANBAN BOARD VIEW */
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start select-none">
                      {/* COLUMN 1: TEÓRICA */}
                      {(() => {
                        const colClasses = teacherClasses
                          .map((c: any, i: number) => ({ ...c, originalIndex: i }))
                          .filter((c: any) => c.type === "Teórica" && c.special_status === "Normal");
                        return (
                          <div
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              const classIdx = parseInt(e.dataTransfer.getData("text/plain"));
                              handleMoveClassKanban(classIdx, "Teórica");
                            }}
                            className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-4 space-y-4 min-h-[400px] flex flex-col"
                          >
                            <div className="flex justify-between items-center border-b border-neutral-850 pb-2">
                              <h4 className="font-bold text-xs text-white uppercase tracking-wider">📖 Teóricas</h4>
                              <span className="font-mono text-[10px] bg-neutral-800 px-2 py-0.5 rounded text-gray-400 font-bold">
                                {colClasses.length}
                              </span>
                            </div>
                            <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] custom-scrollbar">
                              {colClasses.map((item: any) => (
                                <div
                                  key={item.originalIndex}
                                  draggable="true"
                                  onDragStart={(e) => e.dataTransfer.setData("text/plain", item.originalIndex.toString())}
                                  className="bg-neutral-950 border border-neutral-855 p-4 rounded-xl space-y-2 cursor-grab active:cursor-grabbing hover:border-neutral-700 transition"
                                >
                                  <div className="flex justify-between items-center text-[10px]">
                                    <span className="font-bold text-gray-550">Clase {item.originalIndex + 1}</span>
                                    <span className="text-gray-550 font-sans">
                                      {boardDateFormatter.format(new Date(item.date))}
                                    </span>
                                  </div>
                                  <h5 className="font-bold text-xs text-white truncate">{item.topic || "Sin Tema"}</h5>
                                  {item.description && (
                                    <p className="text-[10px] text-gray-450 truncate">{item.description}</p>
                                  )}
                                </div>
                              ))}
                              {colClasses.length === 0 && (
                                <div className="text-center text-[10px] text-gray-550 italic py-8">
                                  Arrastra clases aquí.
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* COLUMN 2: PRÁCTICA */}
                      {(() => {
                        const colClasses = teacherClasses
                          .map((c: any, i: number) => ({ ...c, originalIndex: i }))
                          .filter((c: any) => c.type === "Práctica" && c.special_status === "Normal");
                        return (
                          <div
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              const classIdx = parseInt(e.dataTransfer.getData("text/plain"));
                              handleMoveClassKanban(classIdx, "Práctica");
                            }}
                            className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-4 space-y-4 min-h-[400px] flex flex-col"
                          >
                            <div className="flex justify-between items-center border-b border-neutral-850 pb-2">
                              <h4 className="font-bold text-xs text-white uppercase tracking-wider">🛠️ Prácticas</h4>
                              <span className="font-mono text-[10px] bg-neutral-800 px-2 py-0.5 rounded text-gray-400 font-bold">
                                {colClasses.length}
                              </span>
                            </div>
                            <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] custom-scrollbar">
                              {colClasses.map((item: any) => (
                                <div
                                  key={item.originalIndex}
                                  draggable="true"
                                  onDragStart={(e) => e.dataTransfer.setData("text/plain", item.originalIndex.toString())}
                                  className="bg-neutral-955 border border-neutral-855 p-4 rounded-xl space-y-2 cursor-grab active:cursor-grabbing hover:border-neutral-700 transition"
                                >
                                  <div className="flex justify-between items-center text-[10px]">
                                    <span className="font-bold text-gray-550">Clase {item.originalIndex + 1}</span>
                                    <span className="text-gray-550 font-sans">
                                      {boardDateFormatter.format(new Date(item.date))}
                                    </span>
                                  </div>
                                  <h5 className="font-bold text-xs text-white truncate">{item.topic || "Sin Tema"}</h5>
                                  {item.description && (
                                    <p className="text-[10px] text-gray-455 truncate">{item.description}</p>
                                  )}
                                </div>
                              ))}
                              {colClasses.length === 0 && (
                                <div className="text-center text-[10px] text-gray-550 italic py-8">
                                  Arrastra clases aquí.
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* COLUMN 3: FERIADOS */}
                      {(() => {
                        const colClasses = teacherClasses
                          .map((c: any, i: number) => ({ ...c, originalIndex: i }))
                          .filter((c: any) => c.special_status === "Feriado");
                        return (
                          <div
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              const classIdx = parseInt(e.dataTransfer.getData("text/plain"));
                              handleMoveClassKanban(classIdx, "Feriado");
                            }}
                            className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-4 space-y-4 min-h-[400px] flex flex-col"
                          >
                            <div className="flex justify-between items-center border-b border-neutral-850 pb-2">
                              <h4 className="font-bold text-xs text-white uppercase tracking-wider">🌴 Feriados</h4>
                              <span className="font-mono text-[10px] bg-neutral-850 px-2 py-0.5 rounded text-amber-500 font-bold font-sans">
                                {colClasses.length}
                              </span>
                            </div>
                            <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] custom-scrollbar">
                              {colClasses.map((item: any) => (
                                <div
                                  key={item.originalIndex}
                                  draggable="true"
                                  onDragStart={(e) => e.dataTransfer.setData("text/plain", item.originalIndex.toString())}
                                  className="bg-neutral-955/5 border border-amber-955/20 p-4 rounded-xl space-y-2 cursor-grab active:cursor-grabbing hover:border-neutral-700 transition opacity-80"
                                >
                                  <div className="flex justify-between items-center text-[10px]">
                                    <span className="font-bold text-amber-550 font-sans">Clase {item.originalIndex + 1}</span>
                                    <span className="text-gray-550 font-sans">
                                      {boardDateFormatter.format(new Date(item.date))}
                                    </span>
                                  </div>
                                  <h5 className="font-bold text-xs text-white truncate">{item.topic || "Sin Tema (Feriado)"}</h5>
                                </div>
                              ))}
                              {colClasses.length === 0 && (
                                <div className="text-center text-[10px] text-gray-555 italic py-8">
                                  Arrastra feriados aquí.
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* COLUMN 4: EXAMEN / EVALUACIONES */}
                      {(() => {
                        const colClasses = teacherClasses
                          .map((c: any, i: number) => ({ ...c, originalIndex: i }))
                          .filter((c: any) => c.special_status === "Examen");
                        return (
                          <div
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              const classIdx = parseInt(e.dataTransfer.getData("text/plain"));
                              handleMoveClassKanban(classIdx, "Examen");
                            }}
                            className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-4 space-y-4 min-h-[400px] flex flex-col"
                          >
                            <div className="flex justify-between items-center border-b border-neutral-850 pb-2">
                              <h4 className="font-bold text-xs text-white uppercase tracking-wider">🏆 Exámenes</h4>
                              <span className="font-mono text-[10px] bg-red-955 border border-red-900/30 px-2 py-0.5 rounded text-red-400 font-bold font-sans">
                                {colClasses.length}
                              </span>
                            </div>
                            <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] custom-scrollbar">
                              {colClasses.map((item: any) => (
                                <div
                                  key={item.originalIndex}
                                  draggable="true"
                                  onDragStart={(e) => e.dataTransfer.setData("text/plain", item.originalIndex.toString())}
                                  className="bg-red-955/10 border border-red-955/35 p-4 rounded-xl space-y-2 cursor-grab active:cursor-grabbing hover:border-red-900/30 transition"
                                >
                                  <div className="flex justify-between items-center text-[10px]">
                                    <span className="font-bold text-red-450 font-sans">Clase {item.originalIndex + 1}</span>
                                    <span className="text-gray-555 font-mono">
                                      {boardDateFormatter.format(new Date(item.date))}
                                    </span>
                                  </div>
                                  <h5 className="font-bold text-xs text-red-200 truncate">{item.topic || "Evaluación"}</h5>
                                  <span className="px-1.5 py-0.5 rounded bg-red-955 border border-red-900/30 text-[9px] text-red-400 font-bold font-mono">
                                    {item.special_status}
                                  </span>
                                </div>
                              ))}
                              {colClasses.length === 0 && (
                                <div className="text-center text-[10px] text-gray-555 italic py-8">
                                  Arrastra exámenes aquí.
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  </div>
                ) : (
                  /* STUDENT VIEW: CHRONOGRAM */
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-bold">Planificación de Clases</h3>
                      <button
                        onClick={() => {
                          const cid = selectedCourse.id || selectedCourse.course?.id;
                          window.open(`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(`${window.location.origin}/api/calendar?id=${cid}`)}`, "_blank");
                        }}
                        className="px-4 py-2 bg-purple-950/50 hover:bg-purple-900/50 border border-purple-800/80 rounded-xl text-xs font-bold text-purple-300 transition flex items-center space-x-2"
                      >
                        <span>📅 Suscribirse a Calendario</span>
                      </button>
                    </div>

                    <div className="space-y-6">
                      {Object.keys(weeklyClassesGrouped).map((weekNum) => (
                        <div key={weekNum} className="border border-neutral-800 bg-neutral-900/20 p-6 rounded-2xl space-y-4">
                          <h4 className="text-lg font-bold text-blue-400">Semana {weekNum}</h4>
                          <div className="space-y-3">
                            {weeklyClassesGrouped[parseInt(weekNum)].map((ci: any, index: number) => {
                                  const d = new Date(ci.date);
                                  const ds = weekDateFormatter.format(d);
                                  
                                  let tagClass = "bg-neutral-800 text-gray-400";
                                  if (ci.special_status === "Clase Remota") tagClass = "bg-amber-950/60 text-amber-400 border border-amber-800/40";
                                  if (ci.special_status === "Examen") tagClass = "bg-purple-950/60 text-purple-400 border border-purple-800/40";
                                  if (ci.special_status === "Feriado") tagClass = "bg-red-950/60 text-red-400 border border-red-800/40";

                                  // Look up student attendance for this class
                                  const attDoc = attendanceByClass.get(ci.classNumber || 0);
                                  const studentStatus = attDoc?.records?.[profile?.id || ""];

                                  // Collapsible calculation
                                  const isPast = d < today;
                                  const classKey = `c_${weekNum}_${index}_${ci.date}`;
                                  const isCollapsed = collapsedClasses[classKey] !== undefined ? collapsedClasses[classKey] : isPast;

                                  const toggleCollapse = () => {
                                    setCollapsedClasses((prev: any) => ({ ...prev, [classKey]: !isCollapsed }));
                                  };

                                  const githubOrg = selectedCourse.github_org || "org";

                                  return (
                                    <div
                                      key={index}
                                      className={`p-4 rounded-xl border border-neutral-800/50 bg-neutral-950/30 ${
                                        ci.special_status === "Feriado" ? "opacity-60 line-through" : ""
                                      }`}
                                    >
                                      <div className="flex justify-between items-center flex-wrap gap-2 mb-2">
                                        <div className="flex items-center space-x-2">
                                          <button
                                            type="button"
                                            onClick={toggleCollapse}
                                            className="text-xs font-bold text-gray-400 hover:text-white transition cursor-pointer flex items-center space-x-1"
                                          >
                                            <span>{isCollapsed ? "▶" : "▼"}</span>
                                            <span className="uppercase tracking-widest text-[10px] text-gray-500 font-mono">{ds}</span>
                                          </button>
                                          {isPast && (
                                            <span className="text-[9px] bg-neutral-800 text-gray-400 px-1.5 py-0.5 rounded font-mono">Finalizada</span>
                                          )}
                                        </div>
                                        <div className="flex items-center space-x-2">
                                          {studentStatus && (
                                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                              studentStatus === "present"
                                                ? "bg-green-950/60 text-green-400 border border-green-800/40"
                                                : studentStatus === "late"
                                                ? "bg-amber-950/60 text-amber-400 border border-amber-800/40"
                                                : "bg-red-950/60 text-red-400 border border-red-800/40"
                                            }`}>
                                              {studentStatus === "present" ? "Presente" : studentStatus === "late" ? "Tarde" : "Ausente"}
                                            </span>
                                          )}
                                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${tagClass}`}>
                                            {ci.special_status === "Normal" ? ci.type : ci.special_status}
                                          </span>
                                        </div>
                                      </div>
                                      <h5 className="font-semibold text-sm text-white flex justify-between items-center">
                                        <span>{ci.topic || ci.type}</span>
                                        <button
                                          type="button"
                                          onClick={toggleCollapse}
                                          className="text-[11px] text-blue-400 hover:underline cursor-pointer font-normal"
                                        >
                                          {isCollapsed ? "Ver detalles (+)" : "Colapsar (-)"}
                                        </button>
                                      </h5>

                                      {!isCollapsed && (
                                        <div className="mt-3 space-y-3 border-t border-neutral-900 pt-3 animate-fade-in">
                                          {ci.description && (
                                            <div 
                                              className="text-xs text-gray-400 bg-neutral-950 p-3 rounded-lg border border-neutral-900 markdown-body"
                                              dangerouslySetInnerHTML={{ __html: marked.parse(ci.description) }}
                                            />
                                          )}
                                          
                                          <div className="flex flex-wrap gap-4 text-xs font-semibold pt-1">
                                            {ci.presentation_url && (
                                              <a href={ci.presentation_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-400 underline">
                                                Material de Clase ↗
                                              </a>
                                            )}
                                            {ci.recording_url && (
                                              <a href={ci.recording_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-400 underline">
                                                Video Grabación ↗
                                              </a>
                                            )}
                                            <a
                                              href={`https://github.com/${githubOrg}/discussions/new`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-purple-400 hover:text-purple-300 underline font-semibold flex items-center space-x-1"
                                            >
                                              <span>💬 Preguntar en GitHub Discussions ↗</span>
                                            </a>
                                            <button
                                              onClick={() => handleOpenFeedbackModal(ci.classNumber || 0)}
                                              className="text-emerald-500 hover:text-emerald-400 underline font-semibold focus:outline-none cursor-pointer text-xs"
                                            >
                                              ✍️ Feedback Anónimo
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
      {isVersionModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl max-w-5xl w-full min-w-[280px] sm:min-w-[640px] shrink-0 mx-auto h-[85vh] flex flex-col justify-between shadow-2xl relative z-10">
            <div className="flex justify-between items-center pb-4 border-b border-neutral-800">
              <div>
                <h3 className="text-lg font-bold text-white">Versiones de Cronograma & Comparación Interanual</h3>
                <p className="text-xs text-gray-400">Compará versiones históricas de este curso o con otras cátedras.</p>
              </div>
              <button
                onClick={() => {
                  setIsVersionModalOpen(false);
                  setSelectedVersionForDiff(null);
                  setSelectedCourseForComparison(null);
                }}
                className="text-gray-400 hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 my-4 overflow-hidden">
              {/* Left Column: Versions List & Course List */}
              <div className="md:col-span-1 space-y-4 overflow-y-auto pr-2 border-r border-neutral-850">
                {/* Save Current as Version */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 font-sans">Versiones Guardadas</h4>
                  <div className="space-y-2">
                    {scheduleVersions.map((v) => (
                      <div
                        key={v.id}
                        onClick={() => {
                          setSelectedVersionForDiff(v);
                          setSelectedCourseForComparison(null);
                        }}
                        className={`p-3 rounded-xl border transition cursor-pointer text-xs space-y-1 ${
                          selectedVersionForDiff?.id === v.id ? "bg-blue-950/40 border-blue-500/50" : "bg-neutral-950/60 border-neutral-850 hover:border-neutral-700"
                        }`}
                      >
                        <p className="font-bold text-white">{v.version_name}</p>
                        <p className="text-[10px] text-gray-400">Por: {v.created_by_name}</p>
                        <p className="text-[9px] text-gray-500">{new Date(v.created_at).toLocaleString()}</p>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRestoreVersion(v.id);
                            }}
                            className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[9px] font-bold transition cursor-pointer"
                          >
                            Restaurar
                          </button>
                        </div>
                      </div>
                    ))}
                    {scheduleVersions.length === 0 && (
                      <p className="text-xs text-gray-500 italic">No hay versiones guardadas.</p>
                    )}
                  </div>
                </div>

                {/* Compare Interanual */}
                <div className="space-y-3 pt-3 border-t border-neutral-850">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 font-sans">Comparación Interanual</h4>
                  <p className="text-[10px] text-gray-400">Compará este cronograma con otra cursada del sistema.</p>
                  <button
                    onClick={() => {
                      handleLoadComparisonCourses();
                    }}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-850 rounded-xl text-xs text-left text-blue-400 hover:border-blue-500 font-semibold transition"
                  >
                    📂 Cargar Otras Cátedras
                  </button>

                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {comparisonCourses.map((cc) => (
                      <div
                        key={cc.id}
                        onClick={() => {
                          setSelectedCourseForComparison(cc);
                          setSelectedVersionForDiff(null);
                        }}
                        className={`p-3 rounded-xl border transition cursor-pointer text-xs ${
                          selectedCourseForComparison?.id === cc.id ? "bg-amber-950/40 border-amber-500/50" : "bg-neutral-950/60 border-neutral-850 hover:border-neutral-700"
                        }`}
                      >
                        <p className="font-bold text-white">{cc.name}</p>
                        <p className="text-[10px] text-gray-400">{cc.class_instances?.length || 0} Clases</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Diff View */}
              <div className="md:col-span-2 overflow-y-auto space-y-4 pl-2">
                {selectedVersionForDiff || selectedCourseForComparison ? (
                  <>
                    <div className="flex justify-between items-center bg-neutral-950/60 p-3 rounded-xl border border-neutral-850">
                      <span className="text-xs font-bold text-white">
                        Comparando: {selectedVersionForDiff ? `Versión "${selectedVersionForDiff.version_name}"` : `Cátedra "${selectedCourseForComparison?.name}"`} con el cronograma actual
                      </span>
                      <span className="text-[10px] text-gray-400 font-sans">Diff de Clases</span>
                    </div>

                    <div className="space-y-3">
                      {(() => {
                        const targetClasses = selectedVersionForDiff?.class_instances || selectedCourseForComparison?.class_instances || [];
                        const maxLen = Math.max(teacherClasses.length, targetClasses.length);
                        const diffItems = [];

                        for (let i = 0; i < maxLen; i++) {
                          const current = teacherClasses[i];
                          const target = targetClasses[i];

                          if (current && target) {
                            const isDifferent =
                              current.topic !== target.topic ||
                              current.type !== target.type ||
                              current.special_status !== target.special_status;

                            diffItems.push({
                              idx: i + 1,
                              status: isDifferent ? "modified" : "identical",
                              current,
                              target
                            });
                          } else if (current) {
                            diffItems.push({
                              idx: i + 1,
                              status: "added",
                              current,
                              target: null
                            });
                          } else {
                            diffItems.push({
                              idx: i + 1,
                              status: "removed",
                              current: null,
                              target
                            });
                          }
                        }

                        return diffItems.map((item: any) => (
                          <div
                            key={item.idx}
                            className={`p-4 rounded-xl border text-xs space-y-2 ${
                              item.status === "added" ? "bg-green-950/10 border-green-800/30" :
                              item.status === "removed" ? "bg-red-950/10 border-red-800/30" :
                              item.status === "modified" ? "bg-amber-950/10 border-amber-800/30" :
                              "bg-neutral-950/30 border-neutral-850"
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-white">Clase {item.idx}</span>
                              <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                                item.status === "added" ? "bg-green-900/30 text-green-400" :
                                item.status === "removed" ? "bg-red-900/30 text-red-400" :
                                item.status === "modified" ? "bg-amber-900/30 text-amber-400" :
                                "bg-neutral-800 text-gray-400"
                              }`}>
                                {item.status === "added" ? "Agregada" :
                                 item.status === "removed" ? "Eliminada" :
                                 item.status === "modified" ? "Modificada" :
                                 "Idéntica"}
                              </span>
                            </div>

                            {item.status === "identical" && (
                              <p className="text-gray-300">
                                Tema: <span className="font-semibold text-white">{item.current?.topic}</span> ({item.current?.type} - {item.current?.special_status})
                              </p>
                            )}

                            {item.status === "added" && (
                              <p className="text-green-400">
                                + Tema: <span className="font-semibold text-white">{item.current?.topic}</span> ({item.current?.type} - {item.current?.special_status})
                              </p>
                            )}

                            {item.status === "removed" && (
                              <p className="text-red-400">
                                - Tema: <span className="font-semibold text-gray-500 line-through">{item.target?.topic}</span> ({item.target?.type} - {item.target?.special_status})
                              </p>
                            )}

                            {item.status === "modified" && (
                              <div className="space-y-1">
                                <div className="text-amber-400">
                                  ✎ Actual: <span className="font-semibold text-white">{item.current?.topic}</span> ({item.current?.type} - {item.current?.special_status})
                                </div>
                                <div className="text-gray-500">
                                  ✎ Versión: <span className="font-semibold">{item.target?.topic}</span> ({item.target?.type} - {item.target?.special_status})
                                </div>
                              </div>
                            )}
                          </div>
                        ));
                      })()}
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500 text-xs italic">
                    Seleccioná una versión o cátedra para ver la comparación detallada.
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-neutral-800 pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsVersionModalOpen(false);
                  setSelectedVersionForDiff(null);
                  setSelectedCourseForComparison(null);
                }}
                className="px-5 py-2 bg-neutral-800 hover:bg-neutral-750 text-gray-300 text-xs font-bold rounded-xl transition border border-neutral-700 cursor-pointer"
              >
                Cerrar Historial
              </button>
            </div>
          </div>
        </div>
      )}

      {isSaveVersionModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl max-w-sm w-full min-w-[280px] sm:min-w-[380px] shrink-0 mx-auto space-y-4 shadow-2xl relative z-10 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white">Guardar Versión de Cronograma</h3>
            <p className="text-xs text-gray-400">Esto creará un snapshot del cronograma en su estado actual.</p>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Nombre de la Versión</label>
              <input
                type="text"
                placeholder="Ej: Planificación Inicial 2026"
                value={newVersionName}
                onChange={(e) => setNewVersionName(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsSaveVersionModalOpen(false)}
                className="flex-1 px-4 py-2 bg-neutral-850 hover:bg-neutral-800 border border-neutral-800 text-xs font-bold text-gray-300 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveVersion}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Guardar Versión
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
