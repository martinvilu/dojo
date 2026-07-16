"use client";

import React, { useState } from "react";

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: "admin" | "teacher" | "student";
  avatar_url?: string;
  account_status: "pending" | "approved";
  matricula_unrn?: string;
  cohorte?: string;
  created_at?: any;
  last_login?: any;
}

interface AdminPanelProps {
  activeTab: string;
  courses: any[];
  users: UserProfile[];
  globalCalendarUrl: string;
  setGlobalCalendarUrl: (val: string) => void;
  newCourseName: string;
  setNewCourseName: (val: string) => void;
  newCourseOrg: string;
  setNewCourseOrg: (val: string) => void;
  handleCreateCourse: (e: React.FormEvent) => void;
  handleUpdateUserRole: (uid: string, newRole: "admin" | "teacher" | "student") => void;
  handleApproveUser: (uid: string) => void;
  handleSaveSettings: (e: React.FormEvent) => void;
  viewCourseDetails: (course: any) => void;
}

export default function AdminPanel({
  activeTab,
  courses,
  users,
  globalCalendarUrl,
  setGlobalCalendarUrl,
  newCourseName,
  setNewCourseName,
  newCourseOrg,
  setNewCourseOrg,
  handleCreateCourse,
  handleUpdateUserRole,
  handleApproveUser,
  handleSaveSettings,
  viewCourseDetails,
}: AdminPanelProps) {
  const [sortField, setSortField] = useState<string>("full_name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const formatDate = (val: any) => {
    if (!val) return "-";
    let date: Date;
    if (val.seconds) {
      date = new Date(val.seconds * 1000);
    } else if (val instanceof Date) {
      date = val;
    } else {
      date = new Date(val);
    }
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const sortedUsers = [...users].sort((a, b) => {
    let aVal = a[sortField as keyof UserProfile];
    let bVal = b[sortField as keyof UserProfile];

    if (sortField === "created_at" || sortField === "last_login") {
      const aTime = aVal ? (aVal.seconds ? aVal.seconds * 1000 : new Date(aVal).getTime()) : 0;
      const bTime = bVal ? (bVal.seconds ? bVal.seconds * 1000 : new Date(bVal).getTime()) : 0;
      return sortDirection === "asc" ? aTime - bTime : bTime - aTime;
    }

    if (!aVal) aVal = "";
    if (!bVal) bVal = "";

    if (typeof aVal === "string") {
      aVal = aVal.toLowerCase();
      bVal = (bVal as string).toLowerCase();
    }

    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });
  return (
    <>
      {/* 1. ADMIN COURSES */}
      {activeTab === "admin-courses" && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Gestión de Cátedras</h2>

          {/* Create course */}
          <form onSubmit={handleCreateCourse} className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Nombre de la Cátedra</label>
              <input
                type="text"
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
                placeholder="Ej: Programación II"
                className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-white"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Organización GitHub</label>
              <input
                type="text"
                value={newCourseOrg}
                onChange={(e) => setNewCourseOrg(e.target.value)}
                placeholder="Ej: unrn-prog2-2026"
                className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-white"
              />
            </div>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-2.5 rounded-xl transition cursor-pointer"
            >
              Crear Nueva Cátedra
            </button>
          </form>

          {/* Courses List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {courses.map((c) => (
              <div key={c.id} className="bg-neutral-900/40 border border-neutral-800 p-6 rounded-2xl flex flex-col justify-between hover:border-neutral-700 transition">
                <div>
                  <h3 className="text-lg font-bold text-white">{c.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">Organización: {c.github_org || "Ninguna"}</p>
                  <p className="text-xs text-amber-500 mt-1 font-mono">Código: {c.invite_code}</p>
                </div>
                <div className="mt-4 flex space-x-2">
                  <button
                    onClick={() => viewCourseDetails(c)}
                    className="px-4 py-2 bg-neutral-850 hover:bg-neutral-800 rounded-xl text-xs font-medium border border-neutral-800 transition cursor-pointer"
                  >
                    Ver Detalle
                  </button>
                </div>
              </div>
            ))}
            {courses.length === 0 && (
              <p className="text-gray-500 text-sm col-span-2">No hay cátedras registradas en la base de datos.</p>
            )}
          </div>
        </div>
      )}

      {/* 2. ADMIN USERS */}
      {activeTab === "admin-users" && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Usuarios Registrados</h2>
          <div className="overflow-x-auto bg-neutral-900/40 border border-neutral-800 rounded-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-950/40 text-xs font-semibold text-gray-400 uppercase tracking-wider select-none">
                  <th className="p-4 cursor-pointer hover:text-white transition" onClick={() => handleSort("full_name")}>
                    Nombre {sortField === "full_name" ? (sortDirection === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                  <th className="p-4 cursor-pointer hover:text-white transition" onClick={() => handleSort("email")}>
                    Email {sortField === "email" ? (sortDirection === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                  <th className="p-4 cursor-pointer hover:text-white transition" onClick={() => handleSort("role")}>
                    Rol {sortField === "role" ? (sortDirection === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                  <th className="p-4 cursor-pointer hover:text-white transition" onClick={() => handleSort("matricula_unrn")}>
                    Matrícula {sortField === "matricula_unrn" ? (sortDirection === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                  <th className="p-4 cursor-pointer hover:text-white transition" onClick={() => handleSort("cohorte")}>
                    Cohorte {sortField === "cohorte" ? (sortDirection === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                  <th className="p-4 cursor-pointer hover:text-white transition" onClick={() => handleSort("created_at")}>
                    Fecha Registro {sortField === "created_at" ? (sortDirection === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                  <th className="p-4 cursor-pointer hover:text-white transition" onClick={() => handleSort("last_login")}>
                    Último Acceso {sortField === "last_login" ? (sortDirection === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                  <th className="p-4 cursor-pointer hover:text-white transition" onClick={() => handleSort("account_status")}>
                    Estado {sortField === "account_status" ? (sortDirection === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                  <th className="p-4">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-850 text-sm text-gray-300">
                {sortedUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-neutral-900/10 transition-colors">
                    <td className="p-4 font-medium text-white">{u.full_name || "-"}</td>
                    <td className="p-4">{u.email}</td>
                    <td className="p-4">
                      <select
                        value={u.role}
                        onChange={(e) => handleUpdateUserRole(u.id, e.target.value as any)}
                        className="bg-neutral-950/80 border border-neutral-800 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-blue-500 text-white cursor-pointer"
                      >
                        <option value="admin">Administrador</option>
                        <option value="teacher">Profesor</option>
                        <option value="student">Estudiante</option>
                      </select>
                    </td>
                    <td className="p-4 font-mono">{u.matricula_unrn || "-"}</td>
                    <td className="p-4">{u.cohorte || "-"}</td>
                    <td className="p-4 text-xs font-mono text-gray-400">{formatDate(u.created_at)}</td>
                    <td className="p-4 text-xs font-mono text-gray-400">{formatDate(u.last_login)}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        u.account_status === "approved" ? "bg-green-950/50 text-green-400" : "bg-amber-950/50 text-amber-400"
                      }`}>
                        {u.account_status === "approved" ? "Aprobado" : "Pendiente"}
                      </span>
                    </td>
                    <td className="p-4">
                      {u.account_status === "pending" && (
                        <button
                          onClick={() => handleApproveUser(u.id)}
                          className="bg-green-600 hover:bg-green-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer"
                        >
                          Aprobar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. ADMIN SETTINGS */}
      {activeTab === "admin-settings" && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Configuración Global del Sistema</h2>
          <form onSubmit={handleSaveSettings} className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 space-y-4 max-w-xl">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                URL de Calendario Global (.ics)
              </label>
              <input
                type="url"
                value={globalCalendarUrl}
                onChange={(e) => setGlobalCalendarUrl(e.target.value)}
                placeholder="https://example.com/calendar.ics"
                className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-white"
              />
            </div>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition cursor-pointer"
            >
              Guardar Configuración
            </button>
          </form>
        </div>
      )}
    </>
  );
}
