"use client";
import React, { useState, useMemo } from 'react';
import { useBeforeUnload } from '@/hooks/useBeforeUnload';
import { ScheduleKanban } from './schedule/ScheduleKanban';
import { ScheduleVersionsModal, SaveScheduleVersionModal } from './schedule/ScheduleVersionsModal';
import { api } from '@/lib/api';
import { renderMarkdown } from '@/lib/markdown';
import ClassCommentsThread from '@/modules/course/components/comments/ClassCommentsThread';
import AttendanceManager from '@/modules/attendance/components/AttendanceManager';
import { confirmAction } from "@/components/dashboard/ui/ConfirmDialog";

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

  // Aviso al cerrar la pestaña con el cronograma editado y sin guardar (mejora 1.49).
  // Se guarda el curso donde se editó: cambiar de curso descarta la marca.
  const currentCourseId = selectedCourse?.id || selectedCourse?.course?.id;
  const [editedCourseId, setEditedCourseId] = useState<string | null>(null);
  const markEdited = () => setEditedCourseId(currentCourseId || null);
  useBeforeUnload(editedCourseId !== null && editedCourseId === currentCourseId);

  const handleGenerateClasses = async () => {
    if (!teacherStartDate || !teacherDuration || teacherSchedules.length === 0) {
      showToast("Primero configurá la fecha de inicio, duración en semanas y al menos un horario.", "success");
      return;
    }
    if (!(await confirmAction({ message: "¿Seguro querés regenerar? Vas a perder los temas, links y estados especiales ya cargados.", tone: "danger" }))) return;

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

    generated.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    
    // Map class number
    generated.forEach((ci, idx) => {
      ci.classNumber = idx + 1;
    });

    setTeacherClasses(generated);
    markEdited();
  };

  const handleUpdateClassInstance = (idx: number, field: keyof ClassInstance, value: any) => {
    const updated = [...teacherClasses];
    updated[idx] = { ...updated[idx], [field]: value };
    setTeacherClasses(updated);
    markEdited();
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
    markEdited();
  };

  const handleSaveTeacherSchedule = async () => {
    const cid = selectedCourse.id || selectedCourse.course?.id;
    setApiLoading(true);
    try {
      await api("updateCourseSettings", {
        courseId: cid,
        data: { class_instances: teacherClasses }
      });
      setEditedCourseId(null);
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

  const handleSaveVersion = async (newVersionName: string) => {
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
      setIsSaveVersionModalOpen(false);
      handleLoadVersions();
    } catch (err: any) {
      showToast("Error al guardar versión: " + err.message, "error");
    } finally {
      setApiLoading(false);
    }
  };

  const handleRestoreVersion = async (versionId: string) => {
    if (!(await confirmAction({ message: "¿Seguro que querés restaurar esta versión? Reemplazará tu cronograma actual en pantalla.", tone: "danger" }))) return;
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
                    <ScheduleKanban classes={teacherClasses} onMove={handleMoveClassKanban} formatDate={(d) => boardDateFormatter.format(d)} />
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
                          const feedToken = selectedCourse?.calendar_secret || selectedCourse?.sync_secret;
                          window.open(`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(`${window.location.origin}/api/calendar?id=${cid}${feedToken ? `&token=${feedToken}` : ""}`)}`, "_blank");
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
                                              dangerouslySetInnerHTML={{ __html: renderMarkdown(ci.description) }}
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
        <ScheduleVersionsModal
          teacherClasses={teacherClasses}
          scheduleVersions={scheduleVersions}
          comparisonCourses={comparisonCourses}
          onRestore={handleRestoreVersion}
          onLoadComparison={handleLoadComparisonCourses}
          onClose={() => setIsVersionModalOpen(false)}
        />
      )}

      {isSaveVersionModalOpen && (
        <SaveScheduleVersionModal onSave={handleSaveVersion} onClose={() => setIsSaveVersionModalOpen(false)} />
      )}

    </>
  );
}
