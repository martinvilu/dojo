"use client";

import React from "react";

interface StudentPanelProps {
  activeTab: string;
  courses: any[];
  enrollCode: string;
  setEnrollCode: (val: string) => void;
  handleEnrollCourse: (e: React.FormEvent) => void;
  viewCourseDetails: (course: any) => void;
  onOpenCourseCalendar?: (courseId: string) => void;
  onOpenQrScanner?: () => void;
}

export default function StudentPanel({
  activeTab,
  courses,
  enrollCode,
  setEnrollCode,
  handleEnrollCourse,
  viewCourseDetails,
  onOpenCourseCalendar,
  onOpenQrScanner,
}: StudentPanelProps) {
  if (activeTab !== "student-courses") return null;

  return (
    <div className="space-y-6">
      {/* Header & Quick Action Row */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 bg-bg-secondary p-5 rounded-2xl border border-border-custom shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Mis Cursadas</h2>
          <p className="text-xs text-text-secondary mt-0.5">Gestión de materias inscriptas, asistencia y entregas de código.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Prominent QR Scanner Button for Student */}
          {onOpenQrScanner && (
            <button
              type="button"
              onClick={onOpenQrScanner}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition cursor-pointer flex items-center space-x-2 shadow-sm border border-emerald-500/30"
            >
              <span>📷</span>
              <span>Escanear QR Asistencia</span>
            </button>
          )}

          {/* Join Course Form */}
          <form onSubmit={handleEnrollCourse} className="flex gap-2">
            <input
              type="text"
              maxLength={6}
              value={enrollCode}
              onChange={(e) => setEnrollCode(e.target.value)}
              placeholder="Código Cátedra"
              className="bg-bg-primary border border-border-custom rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-blue-500 uppercase font-mono tracking-widest text-center text-text-primary placeholder:text-text-secondary"
              required
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition cursor-pointer"
            >
              Unirse
            </button>
          </form>
        </div>
      </div>

      {/* Courses Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {courses.map((c) => {
          const courseId = c.id || c.course?.id;
          const courseName = c.name || c.course?.name || "Sin nombre";
          const orgName = c.github_org || c.course?.github_org || "No configurada";

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
              className="bg-bg-secondary border border-border-custom p-6 rounded-2xl flex flex-col justify-between hover:border-neutral-700 transition shadow-sm"
            >
              <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                <div className="space-y-1 flex-1">
                  <h3 className="text-lg font-bold text-text-primary">{courseName}</h3>
                  <p className="text-xs text-text-secondary">Organización: <span className="font-semibold text-text-primary">{orgName}</span></p>
                </div>

                <div className="text-left md:text-right space-y-1.5 bg-bg-primary/50 p-3 rounded-xl border border-border-custom text-xs w-full md:w-auto">
                  <div className="text-blue-500 font-semibold text-[11px] space-y-0.5">
                    <p className="font-bold text-[10px] text-text-secondary uppercase tracking-wider">Estado de la Cátedra:</p>
                    <p>📝 Al día con las entregas</p>
                    <p>📅 Clases: {c.class_instances ? c.class_instances.length : 0}</p>
                  </div>
                  <div className="border-t border-border-custom pt-1 mt-1 text-[10px] text-text-secondary font-medium">
                    <p>🕒 Última actualización:</p>
                    <p className="font-mono text-text-primary">{updatedAtStr}</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons (Ingresar, Calendario, QR Asistencia) */}
              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border-custom pt-4">
                <button
                  onClick={() => viewCourseDetails(c)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-sm"
                >
                  Ingresar
                </button>
                <button
                  onClick={() => onOpenCourseCalendar && onOpenCourseCalendar(courseId)}
                  className="px-4 py-2 bg-bg-primary hover:bg-bg-tertiary text-text-primary border border-border-custom rounded-xl text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5"
                >
                  <span>📅</span>
                  <span>Calendario</span>
                </button>
                {onOpenQrScanner && (
                  <button
                    onClick={onOpenQrScanner}
                    className="px-4 py-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 border border-emerald-500/30 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5"
                  >
                    <span>📷</span>
                    <span>Asistencia QR</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {courses.length === 0 && (
          <p className="text-text-secondary text-sm">No te has inscripto en ninguna cátedra aún. Coloca el código provisto por tu profesor.</p>
        )}
      </div>
    </div>
  );
}
