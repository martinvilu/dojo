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
  github_user?: string;
}

interface ProfilePanelProps {
  activeTab: string;
  profile: UserProfile | null;
  profileMatricula: string;
  setProfileMatricula: (val: string) => void;
  profileCohorte: string;
  setProfileCohorte: (val: string) => void;
  profileGithubUser: string;
  setProfileGithubUser: (val: string) => void;
  handleUpdateProfile: (e: React.FormEvent) => void;
}

export default function ProfilePanel({
  activeTab,
  profile,
  profileMatricula,
  setProfileMatricula,
  profileCohorte,
  setProfileCohorte,
  profileGithubUser,
  setProfileGithubUser,
  handleUpdateProfile,
}: ProfilePanelProps) {
  if (activeTab !== "profile") return null;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Datos Académicos y Perfil</h2>
      <form onSubmit={handleUpdateProfile} className="bg-bg-secondary p-6 rounded-2xl border border-border-custom space-y-4 max-w-xl">
        <div>
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Nombre Completo</label>
          <input
            type="text"
            value={profile?.full_name || ""}
            disabled
            className="w-full bg-bg-primary/50 border border-border-custom rounded-xl px-4 py-2.5 text-sm text-text-secondary cursor-not-allowed"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Correo Primario</label>
          <input
            type="text"
            value={profile?.email || ""}
            disabled
            className="w-full bg-bg-primary/50 border border-border-custom rounded-xl px-4 py-2.5 text-sm text-text-secondary cursor-not-allowed"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Usuario de GitHub</label>
          <input
            type="text"
            value={profileGithubUser}
            onChange={(e) => setProfileGithubUser(e.target.value)}
            placeholder="Ej: nombreusuario-git"
            className="w-full bg-bg-primary border border-border-custom rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-text-primary"
            required
          />
          <p className="text-[10px] text-text-secondary mt-1">Requerido para el seguimiento de commits y entregas.</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Matrícula UNRN</label>
            <input
              type="text"
              value={profileMatricula}
              onChange={(e) => setProfileMatricula(e.target.value)}
              placeholder="Ej: UNRN-12345"
              className="w-full bg-bg-primary border border-border-custom rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-text-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Cohorte / Año de Ingreso</label>
            <input
              type="text"
              value={profileCohorte}
              onChange={(e) => setProfileCohorte(e.target.value)}
              placeholder="Ej: 2026"
              className="w-full bg-bg-primary border border-border-custom rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-text-primary"
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
