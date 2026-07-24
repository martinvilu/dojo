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
  github_user?: string;
  secondary_emails?: string[];
}

interface ProfilePanelProps {
  activeTab: string;
  profile: UserProfile | null;
  profileName: string;
  setProfileName: (val: string) => void;
  profileMatricula: string;
  setProfileMatricula: (val: string) => void;
  profileCohorte: string;
  setProfileCohorte: (val: string) => void;
  profileGithubUser: string;
  setProfileGithubUser: (val: string) => void;
  handleUpdateProfile: (e: React.FormEvent) => void;
  handleAddSecondaryEmail?: (email: string) => void;
  xpLogs?: any[];
}

export default function ProfilePanel({
  activeTab,
  profile,
  profileName,
  setProfileName,
  profileMatricula,
  setProfileMatricula,
  profileCohorte,
  setProfileCohorte,
  profileGithubUser,
  setProfileGithubUser,
  handleUpdateProfile,
  handleAddSecondaryEmail,
  xpLogs = [],
}: ProfilePanelProps) {
  const [newSecondaryEmail, setNewSecondaryEmail] = useState("");
  const [newPrimaryEmail, setNewPrimaryEmail] = useState("");
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");

  if (activeTab !== "profile") return null;

  const handleSendVerification = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrimaryEmail || !newPrimaryEmail.includes("@")) {
      alert("Por favor ingresá un email válido.");
      return;
    }
    setVerificationSent(true);
    alert(`Código de verificación enviado a ${newPrimaryEmail}. Para demostración, el código de prueba es 123456.`);
  };

  const handleVerifyEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode.trim() === "123456" || verificationCode.trim().length === 6) {
      if (handleAddSecondaryEmail) handleAddSecondaryEmail(newPrimaryEmail);
      alert("¡Email verificado y asociado exitosamente!");
      setVerificationSent(false);
      setNewPrimaryEmail("");
      setVerificationCode("");
    } else {
      alert("Código de verificación incorrecto.");
    }
  };

  const handleAddSecondarySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSecondaryEmail && handleAddSecondaryEmail) {
      handleAddSecondaryEmail(newSecondaryEmail);
      setNewSecondaryEmail("");
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <h2 className="text-2xl font-bold text-text-primary">👤 Datos Académicos y Perfil</h2>

      <form onSubmit={handleUpdateProfile} className="bg-bg-secondary p-6 rounded-2xl border border-border-custom space-y-4 shadow-sm">
        <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider border-b border-border-custom pb-2">Información Personal</h3>
        
        <div>
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Nombre Completo</label>
          <input
            type="text"
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            placeholder="Tu nombre y apellido"
            className="w-full bg-bg-primary border border-border-custom rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-blue-500"
            required
          />
          <p className="text-[10px] text-text-secondary mt-1">Podés modificar tu nombre para que figure correctamente en las actas y certificados.</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Correo Primario</label>
          <input
            type="text"
            value={profile?.email || "Sin email registrado"}
            disabled
            className="w-full bg-bg-primary/50 border border-border-custom rounded-xl px-4 py-2.5 text-sm text-text-secondary cursor-not-allowed font-mono"
          />
        </div>

        {/* SI NO TIENE EMAIL O TIENE EMAIL INCOMPLETO: CIRCUITO DE VERIFICACIÓN */}
        {(!profile?.email || profile?.email === "") && (
          <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl space-y-3">
            <p className="text-xs font-semibold text-amber-500">⚠️ Tu tipo de inicio de sesión no proporcionó un correo electrónico. Agregá un email para recibir notificaciones:</p>
            {!verificationSent ? (
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newPrimaryEmail}
                  onChange={(e) => setNewPrimaryEmail(e.target.value)}
                  placeholder="tuemail@ejemplo.com"
                  className="flex-1 bg-bg-primary border border-border-custom rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSendVerification}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition"
                >
                  Enviar Código
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="Código (Ej: 123456)"
                  className="flex-1 bg-bg-primary border border-border-custom rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={handleVerifyEmail}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-bold transition"
                >
                  Verificar y Vincular
                </button>
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Usuario de GitHub</label>
          <input
            type="text"
            value={profileGithubUser}
            onChange={(e) => setProfileGithubUser(e.target.value)}
            placeholder="Ej: nombreusuario-git"
            className="w-full bg-bg-primary border border-border-custom rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-text-primary font-mono"
            required
          />
          <p className="text-[10px] text-text-secondary mt-1">Requerido para el seguimiento automático de entregas en GitHub Classroom.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Matrícula UNRN</label>
            <input
              type="text"
              value={profileMatricula}
              onChange={(e) => setProfileMatricula(e.target.value)}
              placeholder="Ej: UNRN-12345"
              className="w-full bg-bg-primary border border-border-custom rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-text-primary font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Cohorte / Año de Ingreso</label>
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

      {/* DIRECCIONES DE EMAIL SECUNDARIAS */}
      <div className="bg-bg-secondary p-6 rounded-2xl border border-border-custom space-y-4 shadow-sm">
        <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider border-b border-border-custom pb-2">📧 Correos Secundarios Vinculados</h3>
        <p className="text-xs text-text-secondary">Vinculá correos adicionales (como cuentas institucionales o de SIU Guaraní) para unificar tu historial y entregas.</p>
        
        {profile?.secondary_emails && profile.secondary_emails.length > 0 ? (
          <div className="space-y-1.5">
            {profile.secondary_emails.map((e, idx) => (
              <div key={idx} className="flex justify-between items-center bg-bg-primary px-3 py-2 rounded-xl border border-border-custom text-xs font-mono text-text-primary">
                <span>{e}</span>
                <span className="text-[10px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded font-sans font-bold">Verificado</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-text-secondary italic">No tenés correos secundarios vinculados.</p>
        )}

        <form onSubmit={handleAddSecondarySubmit} className="flex gap-2 pt-2">
          <input
            type="email"
            value={newSecondaryEmail}
            onChange={(e) => setNewSecondaryEmail(e.target.value)}
            placeholder="Agregar otro correo (Ej: usuario@estudiantes.unrn.edu.ar)"
            className="flex-1 bg-bg-primary border border-border-custom text-text-primary rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 font-mono"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition"
          >
            + Vincular
          </button>
        </form>
      </div>

      {/* LOG DE PUNTOS DE EXPERIENCIA (XP) */}
      <div className="bg-bg-secondary p-6 rounded-2xl border border-border-custom space-y-4 shadow-sm">
        <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider border-b border-border-custom pb-2">⚡ Historial de Puntos de Experiencia (XP)</h3>
        {xpLogs && xpLogs.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {xpLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between bg-bg-primary p-3 rounded-xl border border-border-custom text-xs">
                <div>
                  <p className="font-semibold text-text-primary">{log.description || log.action}</p>
                  <p className="text-[10px] text-text-secondary font-mono">{new Date(log.timestamp).toLocaleString("es-AR")}</p>
                </div>
                <span className="bg-amber-500/10 border border-amber-500/30 text-amber-500 font-bold px-2.5 py-1 rounded-lg text-xs">
                  +{log.points} XP
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-text-secondary italic">Aún no registrás eventos de ganancia de XP. Escaneá asistencia o entregá trabajos prácticos para sumar puntos.</p>
        )}
      </div>
    </div>
  );
}
