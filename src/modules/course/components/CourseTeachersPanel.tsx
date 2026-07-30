
"use client";
import React from "react";

export function CourseTeachersPanel(props: any) {
  const {
    courseTeachers, selectedNewTeacherId, setSelectedNewTeacherId, allTeachersList, handleAssignTeacher, handleRemoveTeacher, profile, courseSubTab
  } = props;
  return (
    <>
                  {courseSubTab === "teachers" && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold">Docentes Asignados</h3>
                </div>

                {profile?.role === "admin" && (
                  <div className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 space-y-4">
                    <h4 className="text-sm font-semibold text-white">Asignar Nuevo Profesor</h4>
                    <div className="flex flex-col sm:flex-row gap-3 items-end">
                      <div className="flex-1">
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Seleccionar Profesor</label>
                        <select
                          value={selectedNewTeacherId}
                          onChange={(e: any) => setSelectedNewTeacherId(e.target.value)}
                          className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                        >
                          <option value="">Selecciona un profesor...</option>
                          {allTeachersList
                            .filter((t: any) => !courseTeachers.some((ct: any) => ct.teacher_id === t.id))
                            .map((t: any) => (
                              <option key={t.id} value={t.id}>
                                {t.full_name} ({t.email})
                              </option>
                            ))}
                        </select>
                      </div>
                      <button
                        onClick={handleAssignTeacher}
                        disabled={!selectedNewTeacherId}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                      >
                        Asignar Profesor
                      </button>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto bg-neutral-900/40 border border-neutral-800 rounded-2xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-800 bg-neutral-950/40 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        <th className="p-4">Nombre</th>
                        <th className="p-4">Email</th>
                        {profile?.role === "admin" && <th className="p-4">Acciones</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-850 text-sm text-gray-300">
                      {courseTeachers.map((ct: any) => (
                        <tr key={ct.teacher_id}>
                          <td className="p-4 font-medium text-white">{ct.profiles?.full_name || "Docente"}</td>
                          <td className="p-4">{ct.profiles?.email || "-"}</td>
                          {profile?.role === "admin" && (
                            <td className="p-4">
                              <button
                                onClick={() => handleRemoveTeacher(ct.teacher_id)}
                                className="text-red-500 hover:text-red-400 text-xs font-semibold underline"
                              >
                                Desasignar
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                      {courseTeachers.length === 0 && (
                        <tr>
                          <td colSpan={profile?.role === "admin" ? 3 : 2} className="p-4 text-gray-500 text-center">
                            No hay profesores asignados a esta cátedra.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUBTAB: GRUPOS DE ESTUDIO */}
    </>
  );
}
