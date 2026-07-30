"use client";

import React from "react";

interface TeacherPanelProps {
  activeTab: string;
  courses: any[];
  viewCourseDetails: (course: any) => void;
  onOpenCourseCalendar?: (courseId: string) => void;
}

export default function TeacherPanel({
  activeTab,
  courses,
  viewCourseDetails,
  onOpenCourseCalendar,
}: TeacherPanelProps) {
  if (activeTab !== "teacher-courses") return null;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-text-primary">Mis Cátedras Asignadas</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {courses.map((c) => {
          const courseId = c.id || c.course?.id;
          const courseName = c.name || c.course?.name || "Sin nombre";
          const orgName = c.github_org || c.course?.github_org || "No vinculada";
          const inviteCode = c.invite_code || c.course?.invite_code || "N/A";

          const updatedAtRaw = c.updated_at || c.created_at;
          const updatedAtStr = updatedAtRaw
            ? new Date(updatedAtRaw).toLocaleString("es-AR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }) + " hs"
            : new Date().toLocaleString("es-AR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }) + " hs";

          return (
            <div
              key={courseId}
              className="bg-bg-secondary border border-border-custom p-6 rounded-2xl flex flex-col justify-between hover:border-neutral-700 transition shadow-sm relative"
            >
              <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                {/* Left details */}
                <div className="space-y-1 flex-1">
                  <h3 className="text-lg font-bold text-text-primary">{courseName}</h3>
                  <p className="text-xs text-text-secondary">Organización: <span className="font-semibold text-text-primary">{orgName}</span></p>
                  <div className="mt-3 flex items-center space-x-2">
                    <span className="text-xs text-text-secondary">Código de Invitación Estudiante:</span>
                    <span className="text-sm text-blue-500 font-mono font-bold tracking-wider">{inviteCode}</span>
                  </div>
                </div>

                {/* Right stats & last update (annotated in user image) */}
                <div className="text-left md:text-right space-y-1.5 bg-bg-primary/50 p-3 rounded-xl border border-border-custom text-xs w-full md:w-auto">
                  <div className="text-amber-500 dark:text-amber-400 font-semibold text-[11px] space-y-0.5">
                    <p className="font-bold text-[10px] text-text-secondary uppercase tracking-wider">Estado de la Cátedra:</p>
                    <p>📝 {c.pending_corrections || 0} pendientes por corregir</p>
                    <p>📅 {c.class_instances ? c.class_instances.length : 0} clases programadas</p>
                  </div>
                  <div className="border-t border-border-custom pt-1 mt-1 text-[10px] text-text-secondary font-medium">
                    <p>🕒 Última actualización:</p>
                    <p className="font-mono text-text-primary">{updatedAtStr}</p>
                  </div>
                </div>
              </div>

              {/* Action buttons (Ingresar a Cátedra & Calendario) */}
              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border-custom pt-4">
                <button
                  onClick={() => viewCourseDetails(c)}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-sm"
                >
                  Ingresar a Cátedra
                </button>
                <button
                  onClick={() => onOpenCourseCalendar && onOpenCourseCalendar(courseId)}
                  className="px-5 py-2.5 bg-bg-primary hover:bg-bg-tertiary text-text-primary border border-border-custom rounded-xl text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5"
                >
                  <span>📅</span>
                  <span>Calendario</span>
                </button>
              </div>
            </div>
          );
        })}
        {courses.length === 0 && (
          <p className="text-text-secondary text-sm">No tienes materias asignadas todavía.</p>
        )}
      </div>
    </div>
  );
}
