"use client";

import React from "react";

interface StudentPanelProps {
  activeTab: string;
  courses: any[];
  enrollCode: string;
  setEnrollCode: (val: string) => void;
  handleEnrollCourse: (e: React.FormEvent) => void;
  viewCourseDetails: (course: any) => void;
}

export default function StudentPanel({
  activeTab,
  courses,
  enrollCode,
  setEnrollCode,
  handleEnrollCourse,
  viewCourseDetails,
}: StudentPanelProps) {
  if (activeTab !== "student-courses") return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <h2 className="text-2xl font-bold">Mis Cursadas</h2>
        
        <form onSubmit={handleEnrollCourse} className="flex gap-2">
          <input
            type="text"
            maxLength={6}
            value={enrollCode}
            onChange={(e) => setEnrollCode(e.target.value)}
            placeholder="Código Cátedra"
            className="bg-neutral-900/60 border border-neutral-800 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-blue-500 uppercase font-mono tracking-widest text-center text-white"
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {courses.map((c) => (
          <div key={c.id} className="bg-neutral-900/40 border border-neutral-800 p-6 rounded-2xl flex flex-col justify-between hover:border-neutral-700 transition">
            <div>
              <h3 className="text-lg font-bold text-white">{c.name}</h3>
              <p className="text-xs text-gray-500 mt-1">Organización: {c.github_org || "No configurada"}</p>
            </div>
            <div className="mt-4 flex space-x-2">
              <button
                onClick={() => viewCourseDetails(c)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Ingresar
              </button>
            </div>
          </div>
        ))}
        {courses.length === 0 && (
          <p className="text-gray-500 text-sm">No te has inscripto en ninguna cátedra aún. Coloca el código provisto por tu profesor.</p>
        )}
      </div>
    </div>
  );
}
