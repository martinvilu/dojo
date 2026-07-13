"use client";

import React from "react";

interface TeacherPanelProps {
  activeTab: string;
  courses: any[];
  viewCourseDetails: (course: any) => void;
}

export default function TeacherPanel({
  activeTab,
  courses,
  viewCourseDetails,
}: TeacherPanelProps) {
  if (activeTab !== "teacher-courses") return null;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Mis Cátedras Asignadas</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {courses.map((c) => (
          <div key={c.id} className="bg-neutral-900/40 border border-neutral-800 p-6 rounded-2xl flex flex-col justify-between hover:border-neutral-700 transition">
            <div>
              <h3 className="text-lg font-bold text-white">{c.name}</h3>
              <p className="text-xs text-gray-500 mt-1">Organización: {c.github_org || "No vinculada"}</p>
              <div className="mt-3 flex items-center space-x-2">
                <span className="text-xs text-gray-400">Código de Invitación Estudiante:</span>
                <span className="text-sm text-blue-400 font-mono font-bold tracking-wider">{c.invite_code}</span>
              </div>
            </div>
            <div className="mt-4 flex space-x-2">
              <button
                onClick={() => viewCourseDetails(c)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Ingresar a Cátedra
              </button>
            </div>
          </div>
        ))}
        {courses.length === 0 && (
          <p className="text-gray-500 text-sm">No tienes materias asignadas todavía.</p>
        )}
      </div>
    </div>
  );
}
