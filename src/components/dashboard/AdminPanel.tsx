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
  handleDeleteUser: (uid: string) => void;
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
  handleDeleteUser,
  handleSaveSettings,
  viewCourseDetails,
}: AdminPanelProps) {
  const [sortField, setSortField] = useState<string>("full_name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);

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
          <form onSubmit={handleCreateCourse} className="bg-bg-secondary p-6 rounded-2xl border border-border-custom grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Nombre de la Cátedra</label>
              <input
                type="text"
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
                placeholder="Ej: Programación II"
                className="w-full bg-bg-primary border border-border-custom rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-text-primary"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Organización GitHub</label>
              <input
                type="text"
                value={newCourseOrg}
                onChange={(e) => setNewCourseOrg(e.target.value)}
                placeholder="Ej: unrn-prog2-2026"
                className="w-full bg-bg-primary border border-border-custom rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-text-primary"
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
              <div key={c.id} className="bg-bg-secondary border border-border-custom p-6 rounded-2xl flex flex-col justify-between hover:border-text-secondary transition shadow-sm">
                <div>
                  <h3 className="text-lg font-bold text-text-primary">{c.name}</h3>
                  <p className="text-xs text-text-secondary mt-1">Organización: {c.github_org || "Ninguna"}</p>
                  <p className="text-xs text-amber-500 mt-1 font-mono">Código: {c.invite_code}</p>
                </div>
                <div className="mt-4 flex space-x-2">
                  <button
                    onClick={() => viewCourseDetails(c)}
                    className="px-4 py-2 bg-bg-tertiary hover:bg-bg-primary text-text-primary rounded-xl text-xs font-medium border border-border-custom transition cursor-pointer"
                  >
                    Ver Detalle
                  </button>
                </div>
              </div>
            ))}
            {courses.length === 0 && (
              <p className="text-text-muted text-sm col-span-2">No hay cátedras registradas en la base de datos.</p>
            )}
          </div>
        </div>
      )}

      {/* 2. ADMIN USERS */}
      {activeTab === "admin-users" && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Usuarios Registrados</h2>
          <div className="overflow-x-auto bg-bg-secondary border border-border-custom rounded-2xl shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-custom bg-bg-tertiary/50 text-xs font-semibold text-text-secondary uppercase tracking-wider select-none">
                  <th className="p-4 cursor-pointer hover:text-text-primary transition" onClick={() => handleSort("full_name")}>
                    Nombre {sortField === "full_name" ? (sortDirection === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                  <th className="p-4 cursor-pointer hover:text-text-primary transition" onClick={() => handleSort("email")}>
                    Email {sortField === "email" ? (sortDirection === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                  <th className="p-4 cursor-pointer hover:text-text-primary transition" onClick={() => handleSort("role")}>
                    Rol {sortField === "role" ? (sortDirection === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                  <th className="p-4 cursor-pointer hover:text-text-primary transition" onClick={() => handleSort("matricula_unrn")}>
                    Matrícula {sortField === "matricula_unrn" ? (sortDirection === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                  <th className="p-4 cursor-pointer hover:text-text-primary transition" onClick={() => handleSort("cohorte")}>
                    Cohorte {sortField === "cohorte" ? (sortDirection === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                  <th className="p-4 cursor-pointer hover:text-text-primary transition" onClick={() => handleSort("created_at")}>
                    Fecha Registro {sortField === "created_at" ? (sortDirection === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                  <th className="p-4 cursor-pointer hover:text-text-primary transition" onClick={() => handleSort("last_login")}>
                    Último Acceso {sortField === "last_login" ? (sortDirection === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                  <th className="p-4 cursor-pointer hover:text-text-primary transition" onClick={() => handleSort("account_status")}>
                    Estado {sortField === "account_status" ? (sortDirection === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                  <th className="p-4">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-custom text-sm text-text-secondary">
                {sortedUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-bg-primary/50 transition-colors">
                    <td className="p-4 font-medium text-text-primary">{u.full_name || "-"}</td>
                    <td className="p-4">{u.email}</td>
                    <td className="p-4">
                      <select
                        value={u.role}
                        onChange={(e) => handleUpdateUserRole(u.id, e.target.value as any)}
                        className="bg-bg-primary border border-border-custom rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-blue-500 text-text-primary cursor-pointer"
                      >
                        <option value="admin">Administrador</option>
                        <option value="teacher">Profesor</option>
                        <option value="student">Estudiante</option>
                      </select>
                    </td>
                    <td className="p-4 font-mono">{u.matricula_unrn || "-"}</td>
                    <td className="p-4">{u.cohorte || "-"}</td>
                    <td className="p-4 text-xs font-mono text-text-secondary">{formatDate(u.created_at)}</td>
                    <td className="p-4 text-xs font-mono text-text-secondary">{formatDate(u.last_login)}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        u.account_status === "approved" ? "bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-400" : "bg-amber-100 dark:bg-amber-955/50 text-amber-700 dark:text-amber-400"
                      }`}>
                        {u.account_status === "approved" ? "Aprobado" : "Pendiente"}
                      </span>
                    </td>
                    <td className="p-4 flex items-center space-x-2">
                      {u.account_status === "pending" && (
                        <button
                          onClick={() => handleApproveUser(u.id)}
                          className="bg-green-600 hover:bg-green-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer"
                        >
                          Aprobar
                        </button>
                      )}
                      <button
                        onClick={() => setUserToDelete(u)}
                        className="bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-900/30 text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer"
                      >
                        Borrar
                      </button>
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
          <form onSubmit={handleSaveSettings} className="bg-bg-secondary p-6 rounded-2xl border border-border-custom space-y-4 max-w-xl">
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                URL de Calendario Global (.ics)
              </label>
              <input
                type="url"
                value={globalCalendarUrl}
                onChange={(e) => setGlobalCalendarUrl(e.target.value)}
                placeholder="https://example.com/calendar.ics"
                className="w-full bg-bg-primary border border-border-custom rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-text-primary"
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

      {/* MODAL DE ADVERTENCIA PARA BORRAR USUARIO */}
      {userToDelete && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-bg-secondary border border-border-custom p-6 rounded-3xl max-w-md w-full space-y-6 shadow-2xl relative">
            <div className="flex items-center space-x-3 text-red-500">
              <span className="text-3xl">⚠️</span>
              <h3 className="text-lg font-bold text-text-primary">Advertencia: Borrar Usuario</h3>
            </div>
            
            <div className="space-y-3 text-sm text-text-secondary">
              <p>
                Estás a punto de eliminar permanentemente a <strong className="text-text-primary">{userToDelete.full_name || userToDelete.email}</strong> ({userToDelete.email}) del sistema.
              </p>
              <div className="bg-red-50 dark:bg-red-955/20 border border-red-200 dark:border-red-900/40 p-4 rounded-xl space-y-2">
                <p className="text-xs text-red-600 dark:text-red-400 font-bold uppercase tracking-wider">Esta acción realizará lo siguiente de forma irreversible:</p>
                <ul className="list-disc list-inside text-xs text-text-muted space-y-1.5">
                  <li>Eliminará la cuenta de autenticación (Firebase Auth).</li>
                  <li>Borrará el documento de perfil en la base de datos.</li>
                  <li>Removerá al usuario de todas las cursadas en las que esté inscripto.</li>
                  <li>Eliminará cualquier asignación como docente o ayudante.</li>
                </ul>
              </div>
              <p className="text-xs text-text-muted font-medium">
                ¿Confirmás que querés continuar con la eliminación del usuario?
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="flex-1 px-4 py-2.5 bg-bg-tertiary hover:bg-bg-primary text-text-primary border border-border-custom text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  handleDeleteUser(userToDelete.id);
                  setUserToDelete(null);
                }}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Sí, borrar permanentemente
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
