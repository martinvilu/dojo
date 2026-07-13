"use client";

import React from "react";

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: "admin" | "teacher" | "student";
  avatar_url?: string;
  account_status: "pending" | "approved";
  matricula_unrn?: string;
  cohorte?: string;
}

interface ProfilePanelProps {
  activeTab: string;
  profile: UserProfile | null;
  profileMatricula: string;
  setProfileMatricula: (val: string) => void;
  profileCohorte: string;
  setProfileCohorte: (val: string) => void;
  handleUpdateProfile: (e: React.FormEvent) => void;
}

export default function ProfilePanel({
  activeTab,
  profile,
  profileMatricula,
  setProfileMatricula,
  profileCohorte,
  setProfileCohorte,
  handleUpdateProfile,
}: ProfilePanelProps) {
  if (activeTab !== "profile") return null;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Datos Académicos y Perfil</h2>
      <form onSubmit={handleUpdateProfile} className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800 space-y-4 max-w-xl">
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Nombre Completo</label>
          <input
            type="text"
            value={profile?.full_name || ""}
            disabled
            className="w-full bg-neutral-950/40 border border-neutral-855 rounded-xl px-4 py-2.5 text-sm text-gray-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Correo Primario</label>
          <input
            type="text"
            value={profile?.email || ""}
            disabled
            className="w-full bg-neutral-950/40 border border-neutral-855 rounded-xl px-4 py-2.5 text-sm text-gray-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Matrícula UNRN</label>
            <input
              type="text"
              value={profileMatricula}
              onChange={(e) => setProfileMatricula(e.target.value)}
              placeholder="Ej: UNRN-12345"
              className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Cohorte / Año de Ingreso</label>
            <input
              type="text"
              value={profileCohorte}
              onChange={(e) => setProfileCohorte(e.target.value)}
              placeholder="Ej: 2026"
              className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-white"
            />
          </div>
        </div>
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition cursor-pointer"
        >
          Guardar Cambios
        </button>
      </form>
    </div>
  );
}
