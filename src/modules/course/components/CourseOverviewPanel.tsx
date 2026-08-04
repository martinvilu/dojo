"use client";
import React from 'react';
import { api } from '@/lib/api';

import { useMemo } from 'react';

export function CourseOverviewPanel({
  profile,
  selectedCourse,
  assignments,
  setAssignments,
  showToast,
  setApiLoading,
  overviewSubmissionsList,
  loadingOverviewSubmissions,
  roster,
  courseAttendance,
  courseSubmissions,
  pastDueAssignments,
  setCourseSubTab,
  courseComments,
  setExpandedComments
}: any) {

  const studentsAtRisk = useMemo(() => {
    return roster
      .reduce((acc: any[], student: any) => {
        if (student.role !== "student") return acc;

        const studentAtts = courseAttendance.filter((c: any) => c.records && c.records[student.id]);
        const recordedCount = studentAtts.length;
        const presentOrLate = studentAtts.filter(
          (c: any) => c.records[student.id] === "present" || c.records[student.id] === "late"
        ).length;
        const attendanceRate = recordedCount > 0 ? (presentOrLate / recordedCount) * 100 : 100;
        const hasCriticalAttendance = recordedCount >= 3 && attendanceRate < 75;

        const studentSubmissions = courseSubmissions.filter((s: any) => s.student_id === student.id);
        const hasMissingAssignments = assignments.some((a: any) => {
          const hasSub = studentSubmissions.some((s: any) => s.assignment_id === a.id);
          const isPastDue = pastDueAssignments.has(a.id);
          return !hasSub && isPastDue;
        });

        if (hasCriticalAttendance || hasMissingAssignments) {
          acc.push({
            ...student,
            attendanceRate,
            hasCriticalAttendance,
            hasMissingAssignments,
          });
        }
        return acc;
      }, []);
  }, [roster, courseAttendance, courseSubmissions, assignments, pastDueAssignments]);

  return (
    <>
              <div className="space-y-6 animate-fade-in font-sans">
                {/* 1. Statistics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Card 1: Pending Corrections */}
                  {(() => {
                    const pendingCount = overviewSubmissionsList.filter(
                      (s: any) => s.status === "submitted" && (s.grade === undefined || s.grade === "" || s.grade === null)
                    ).length;
                    return (
                      <div className="bg-neutral-900/60 border border-neutral-800 p-5 rounded-2xl flex items-center justify-between shadow-lg">
                        <div className="space-y-1">
                          <span className="text-[10px] text-gray-550 font-bold uppercase tracking-widest font-sans">Correcciones Pendientes</span>
                          <div className="text-3xl font-black text-amber-500 font-mono">{pendingCount}</div>
                          <p className="text-[10px] text-gray-400">Trabajos entregados sin nota asignada.</p>
                        </div>
                        <div className="text-3xl bg-amber-955 border border-amber-900/30 p-3 rounded-xl text-amber-400">
                          📝
                        </div>
                      </div>
                    );
                  })()}

                  {/* Card 2: Students At Risk */}
                  <div className="bg-neutral-900/60 border border-neutral-800 p-5 rounded-2xl flex items-center justify-between shadow-lg">
                    <div className="space-y-1">
                      <span className="text-[10px] text-gray-550 font-bold uppercase tracking-widest font-sans">Alumnos en Riesgo</span>
                      <div className="text-3xl font-black text-red-500 font-mono">{studentsAtRisk.length}</div>
                      <p className="text-[10px] text-gray-400">Por inasistencias o entregas vencidas.</p>
                    </div>
                    <div className="text-3xl bg-red-950/40 border border-red-900/30 p-3 rounded-xl text-red-400 animate-pulse">
                      ⚠️
                    </div>
                  </div>

                  {/* Card 3: Total Deliveries */}
                  <div className="bg-neutral-900/60 border border-neutral-800 p-5 rounded-2xl flex items-center justify-between shadow-lg">
                    <div className="space-y-1">
                      <span className="text-[10px] text-gray-550 font-bold uppercase tracking-widest font-sans">Entregas Totales</span>
                      <div className="text-3xl font-black text-emerald-500 font-mono">{overviewSubmissionsList.length}</div>
                      <p className="text-[10px] text-gray-400">Trabajos prácticos presentados por la cursada.</p>
                    </div>
                    <div className="text-3xl bg-emerald-955 border border-emerald-900/30 p-3 rounded-xl text-emerald-400">
                      🚀
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Column 1: Deliveries Pending Evaluation */}
                  <div className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 space-y-4 shadow-xl flex flex-col max-h-[500px]">
                    <div className="flex justify-between items-center border-b border-neutral-850 pb-2">
                      <h4 className="font-bold text-sm text-white">Cola de Corrección de Trabajos</h4>
                      <span className="text-[10px] bg-amber-955 text-amber-400 border border-amber-800/40 px-2 py-0.5 rounded font-mono font-bold">
                        Pendientes
                      </span>
                    </div>

                    {loadingOverviewSubmissions ? (
                      <div className="flex flex-col items-center justify-center space-y-2 py-12 flex-1">
                        <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs text-gray-550">Recuperando entregas de la cátedra...</span>
                      </div>
                    ) : (
                      <div className="space-y-3 overflow-y-auto flex-1 pr-1 custom-scrollbar">
                        {overviewSubmissionsList
                          .filter((s: any) => s.status === "submitted" && (s.grade === undefined || s.grade === "" || s.grade === null))
                          .map((sub: any) => {
                            const studentName = sub.profiles?.full_name || sub.profiles?.email || "Estudiante";
                            const studentComm = sub.profiles?.commissions?.[selectedCourse.id || selectedCourse.course?.id] || "";
                            return (
                              <div
                                key={sub.id}
                                className="bg-neutral-950/60 border border-neutral-850 p-4 rounded-xl flex justify-between items-center hover:border-neutral-700 transition"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center space-x-2">
                                    <span className="font-bold text-xs text-white">{studentName}</span>
                                    {studentComm && (
                                      <span className="bg-neutral-800 border border-neutral-750 text-[9px] px-1.5 py-0.5 rounded text-gray-405 font-semibold font-mono">
                                        {studentComm}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-gray-400 flex items-center space-x-1">
                                    <span>Tarea:</span>
                                    <span className="text-amber-500 font-semibold">{sub.assignmentTitle}</span>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setCourseSubTab("assignments");
                                  }}
                                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-bold transition cursor-pointer shadow"
                                >
                                  Evaluar 📝
                                </button>
                              </div>
                            );
                          })}
                        {overviewSubmissionsList.filter(
                          (s: any) => s.status === "submitted" && (s.grade === undefined || s.grade === "" || s.grade === null)
                        ).length === 0 && (
                          <div className="text-center py-12 text-xs text-gray-500 italic space-y-2">
                            <span>✨ ¡Al día! No hay entregas pendientes de corrección.</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Column 2: Recent Forum Consultations */}
                  <div className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 space-y-4 shadow-xl flex flex-col max-h-[500px]">
                    <div className="flex justify-between items-center border-b border-neutral-850 pb-2">
                      <h4 className="font-bold text-sm text-white">Consultas Recientes en Clases</h4>
                      <span className="text-[10px] bg-blue-955 text-blue-300 border border-blue-800/40 px-2 py-0.5 rounded font-mono font-bold font-sans">
                        Foros
                      </span>
                    </div>

                    <div className="space-y-3 overflow-y-auto flex-1 pr-1 custom-scrollbar">
                      {courseComments
                        .filter((c: any) => c.user_role !== "teacher" && !c.is_best_answer)
                        .slice(0, 5)
                        .map((comment: any) => (
                          <div
                            key={comment.id}
                            className="bg-neutral-950/60 border border-neutral-850 p-4 rounded-xl flex flex-col space-y-2 hover:border-neutral-700 transition"
                          >
                            <div className="flex justify-between items-center text-[10px]">
                              <div className="flex items-center space-x-1.5">
                                <span className="font-bold text-blue-400 font-sans">{comment.user_name}</span>
                                <span className="text-gray-500 font-mono">Clase {comment.classNumber}</span>
                              </div>
                              <span className="text-gray-550 font-sans">
                                {comment.created_at?.toDate
                                  ? comment.created_at.toDate().toLocaleDateString("es-AR")
                                  : "Reciente"}
                              </span>
                            </div>
                            <p className="text-xs text-gray-300 line-clamp-2 italic leading-relaxed">
                              "{comment.content}"
                            </p>
                            <div className="flex justify-end pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setExpandedComments((prev: any) => ({ ...prev, [comment.classNumber]: true }));
                                  setCourseSubTab("schedules");
                                }}
                                className="text-[10px] text-amber-500 hover:text-amber-400 font-bold underline focus:outline-none cursor-pointer font-sans"
                              >
                                Responder en Foro ↗
                              </button>
                            </div>
                          </div>
                        ))}
                      {courseComments.filter((c: any) => c.user_role !== "teacher" && !c.is_best_answer).length === 0 && (
                        <div className="text-center py-12 text-xs text-gray-500 italic font-sans">
                          💬 No hay consultas activas sin resolver en los foros.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 3: Students Risk overview */}
                <div className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 space-y-4 shadow-xl">
                  <div className="flex justify-between items-center border-b border-neutral-850 pb-2">
                    <h4 className="font-bold text-sm text-white">Alumnos que requieren Atención</h4>
                    <button
                      type="button"
                      onClick={() => setCourseSubTab("students")}
                      className="text-xs text-blue-400 hover:underline font-semibold cursor-pointer font-sans"
                    >
                      Ver todos 👤
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="text-gray-500 uppercase tracking-widest font-bold text-[9px] border-b border-neutral-850 font-sans">
                          <th className="pb-3">Nombre</th>
                          <th className="pb-3">Comisión</th>
                          <th className="pb-3">Presentismo</th>
                          <th className="pb-3">Alertas</th>
                          <th className="pb-3 text-right">Condición</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-900 text-gray-300">
                        {studentsAtRisk
                          .slice(0, 5)
                          .map((student: any) => (
                            <tr key={student.id} className="hover:bg-neutral-950/20 transition-colors">
                              <td className="py-3 font-semibold text-white font-sans">
                                {student.full_name}
                                <div className="text-[10px] text-gray-500 font-normal">{student.email}</div>
                              </td>
                              <td className="py-3 text-gray-400 font-mono">
                                {student.commissions?.[selectedCourse.id || selectedCourse.course?.id] || "Sin Comisión"}
                              </td>
                              <td className="py-3 font-semibold text-gray-400 font-mono">
                                {student.attendanceRate.toFixed(0)}%
                              </td>
                              <td className="py-3 space-x-1.5">
                                {student.hasCriticalAttendance && (
                                  <span className="px-2 py-0.5 rounded-md bg-red-950 border border-red-800/40 text-red-400 text-[8px] font-bold uppercase tracking-wider font-mono">
                                    Asistencia Crítica
                                  </span>
                                )}
                                {student.hasMissingAssignments && (
                                  <span className="px-2 py-0.5 rounded-md bg-amber-955 border border-amber-800/40 text-amber-400 text-[8px] font-bold uppercase tracking-wider font-mono">
                                    Tareas Atrasadas
                                  </span>
                                )}
                              </td>
                              <td className="py-3 text-right">
                                <span className="px-2 py-0.5 rounded bg-red-950 border border-red-900/40 text-red-400 text-[9px] font-bold uppercase font-mono">
                                  EN RIESGO
                                </span>
                              </td>
                            </tr>
                          ))}
                        {studentsAtRisk.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-gray-500 italic font-sans">
                              💚 Todos los alumnos se encuentran al día con sus asistencias y entregas.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
    </>
  );
}
