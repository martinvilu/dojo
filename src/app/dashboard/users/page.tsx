"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, functions } from "@/lib/firebase/clientApp";
import { httpsCallable } from "firebase/functions";

// Callable API helper
const apiCall = httpsCallable(functions, "api");
const api = async (action: string, payload: any = {}) => {
  const res = await apiCall({ action, payload });
  return res.data as any;
};

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: "admin" | "teacher" | "student";
  account_status: "pending" | "approved";
  matricula_unrn?: string;
  cohorte?: string;
}

export default function UsersPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      setCurrentUser(user);
      try {
        const pRes = await api("getProfile");
        if (!pRes || pRes.role !== "admin") {
          setError("Acceso denegado. Solo los administradores pueden acceder a esta sección.");
          setLoading(false);
          return;
        }
        setProfile(pRes);
        
        // Load all users
        const uRes = await api("getAdminUsers");
        setUsers(uRes || []);
      } catch (err: any) {
        setError("Error al cargar datos: " + err.message);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleUpdateUserRole = async (targetUid: string, newRole: "admin" | "teacher" | "student") => {
    if (!confirm(`¿Estás seguro de que deseas cambiar el rol del usuario a ${newRole === "admin" ? "Administrador" : newRole === "teacher" ? "Profesor" : "Estudiante"}?`)) return;
    setUpdatingUid(targetUid);
    try {
      await api("updateUserRole", { targetUid, newRole });
      const uRes = await api("getAdminUsers");
      setUsers(uRes || []);
    } catch (err: any) {
      alert("Error al cambiar rol: " + err.message);
    } finally {
      setUpdatingUid(null);
    }
  };

  const handleApproveUser = async (targetUid: string) => {
    setUpdatingUid(targetUid);
    try {
      await api("approveUser", { targetUid });
      const uRes = await api("getAdminUsers");
      setUsers(uRes || []);
    } catch (err: any) {
      alert("Error al aprobar usuario: " + err.message);
    } finally {
      setUpdatingUid(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase();
    return (
      (u.full_name || "").toLowerCase().includes(term) ||
      (u.email || "").toLowerCase().includes(term) ||
      (u.matricula_unrn || "").toLowerCase().includes(term)
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-gray-400 font-medium">Cargando panel de usuarios...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 p-6 rounded-2xl text-center space-y-4">
          <span className="text-4xl">⚠️</span>
          <h2 className="text-lg font-bold text-white">Error de Permisos</h2>
          <p className="text-xs text-gray-400">{error}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-neutral-800 pb-6">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Gestión de Usuarios</h1>
            <p className="text-xs text-gray-400 mt-1">
              Administración y control de roles y estados de los usuarios en la plataforma.
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Volver al Dashboard
          </button>
        </div>

        {/* Filters */}
        <div className="bg-neutral-900/60 p-4 rounded-2xl border border-neutral-800 flex items-center">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-2.5 text-gray-500">🔍</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, email o matrícula..."
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-blue-500 text-white"
            />
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto bg-neutral-900/40 border border-neutral-800 rounded-2xl shadow-lg">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-950/60 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <th className="p-4">Usuario</th>
                <th className="p-4">Contacto</th>
                <th className="p-4">Rol</th>
                <th className="p-4">Matrícula / Cohorte</th>
                <th className="p-4">Estado</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-850 text-xs text-gray-300">
              {filteredUsers.map((u) => {
                const isPending = u.account_status === "pending";
                const isUpdating = updatingUid === u.id;

                return (
                  <tr key={u.id} className="hover:bg-neutral-900/20 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-white text-sm">{u.full_name || "Usuario sin nombre"}</div>
                      <div className="text-[10px] text-gray-500 font-mono mt-0.5">{u.id}</div>
                    </td>
                    <td className="p-4">
                      <div>{u.email}</div>
                    </td>
                    <td className="p-4">
                      <select
                        value={u.role}
                        disabled={isUpdating}
                        onChange={(e) => handleUpdateUserRole(u.id, e.target.value as any)}
                        className="bg-neutral-950 border border-neutral-850 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 text-white cursor-pointer"
                      >
                        <option value="admin">Administrador</option>
                        <option value="teacher">Profesor</option>
                        <option value="student">Estudiante</option>
                      </select>
                    </td>
                    <td className="p-4">
                      <div className="font-mono text-gray-300">{u.matricula_unrn || "Sin matrícula"}</div>
                      {u.cohorte && <div className="text-gray-500 text-[10px] mt-0.5">Cohorte: {u.cohorte}</div>}
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-lg font-bold text-[10px] ${
                        !isPending ? "bg-green-950/40 border border-green-900/30 text-green-400" : "bg-amber-950/40 border border-amber-900/30 text-amber-400"
                      }`}>
                        {isPending ? "PENDIENTE" : "APROBADO"}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {isPending ? (
                        <button
                          onClick={() => handleApproveUser(u.id)}
                          disabled={isUpdating}
                          className="px-3.5 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-lg font-bold transition cursor-pointer"
                        >
                          Aprobar
                        </button>
                      ) : (
                        <span className="text-gray-500 italic">No requiere acción</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500 italic">
                    No se encontraron usuarios registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
