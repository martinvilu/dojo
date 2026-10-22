
"use client";
import React, { useState } from "react";
import { api } from "@/lib/api";
import { showToast } from "@/components/dashboard/ui/ToastNotification";

const NO_COMMISSION = "Sin Comisión";

/**
 * Comisiones de un ayudante (plan F0.4). Sin ninguna marcada ve toda la
 * cursada; con alguna, solo califica y toma asistencia de esas comisiones.
 */
function TaCommissions({ courseId, teacher, commissions, editable }: {
  courseId: string;
  teacher: any;
  commissions: string[];
  editable: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(teacher.commissions || []);
  const [saving, setSaving] = useState(false);
  const options = [...commissions, NO_COMMISSION];

  const toggle = async (commission: string) => {
    const next = selected.includes(commission) ? selected.filter((c) => c !== commission) : [...selected, commission];
    setSaving(true);
    try {
      await api("setTeacherCommissions", { courseId, teacherId: teacher.teacher_id, commissions: next });
      setSelected(next);
    } catch (err: any) {
      showToast("No se pudieron guardar las comisiones: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (!editable) {
    return <span className="text-xs text-gray-400">{selected.length ? selected.join(", ") : "Todas"}</span>;
  }
  return (
    <fieldset className="flex flex-wrap gap-2" disabled={saving}>
      <legend className="sr-only">Comisiones de {teacher.profiles?.full_name || "este ayudante"}</legend>
      {options.map((c) => (
        <label key={c} className="flex items-center gap-1 text-xs text-gray-300 cursor-pointer">
          <input type="checkbox" checked={selected.includes(c)} onChange={() => toggle(c)} className="rounded bg-neutral-950 border-neutral-800" />
          {c}
        </label>
      ))}
      {selected.length === 0 && <span className="text-[10px] text-amber-400">Sin restricción: ve todas</span>}
    </fieldset>
  );
}

export function CourseTeachersPanel(props: any) {
  const {
    courseTeachers, selectedNewTeacherId, setSelectedNewTeacherId, allTeachersList, handleAssignTeacher, handleRemoveTeacher, profile, courseSubTab,
    courseId, commissions = [],
  } = props;
  const [newRole, setNewRole] = useState<"titular" | "ayudante">("titular");
  const isAdmin = profile?.role === "admin";
  const canEditCommissions = isAdmin || courseTeachers.some((ct: any) => ct.teacher_id === profile?.id && ct.role !== "ayudante");
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
                      <div>
                        <label htmlFor="newTeacherRole" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Rol</label>
                        <select id="newTeacherRole" value={newRole} onChange={(e) => setNewRole(e.target.value as "titular" | "ayudante")}
                          className="bg-neutral-950 border border-neutral-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500">
                          <option value="titular">Titular</option>
                          <option value="ayudante">Ayudante</option>
                        </select>
                      </div>
                      <button
                        onClick={() => handleAssignTeacher(newRole)}
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
                        <th className="p-4">Rol</th>
                        <th className="p-4">Comisiones</th>
                        {profile?.role === "admin" && <th className="p-4">Acciones</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-850 text-sm text-gray-300">
                      {courseTeachers.map((ct: any) => (
                        <tr key={ct.teacher_id}>
                          <td className="p-4 font-medium text-white">{ct.profiles?.full_name || "Docente"}</td>
                          <td className="p-4">{ct.profiles?.email || "-"}</td>
                          <td className="p-4 capitalize">{ct.role || "titular"}</td>
                          <td className="p-4">
                            {ct.role === "ayudante"
                              ? <TaCommissions courseId={courseId} teacher={ct} commissions={commissions} editable={canEditCommissions} />
                              : <span className="text-xs text-gray-500">Todas</span>}
                          </td>
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
                          <td colSpan={profile?.role === "admin" ? 5 : 4} className="p-4 text-gray-500 text-center">
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
