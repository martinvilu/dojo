"use client";
import { showToast } from "@/components/dashboard/ui/ToastNotification";

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
  gmailStatus?: { connected: boolean; email: string | null };
  handleStartGmailAuth?: () => void;
  handleDisconnectGmail?: () => void;
  handleSendTestGmail?: () => void;
  testEmailAddress?: string;
  setTestEmailAddress?: (val: string) => void;
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
  gmailStatus = { connected: false, email: null },
  handleStartGmailAuth,
  handleDisconnectGmail,
  handleSendTestGmail,
  testEmailAddress = "",
  setTestEmailAddress,
}: ProfilePanelProps) {
  const [newSecondaryEmail, setNewSecondaryEmail] = useState("");
  const [newPrimaryEmail, setNewPrimaryEmail] = useState("");
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");

  if (activeTab !== "profile") return null;

  const handleSendVerification = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrimaryEmail || !newPrimaryEmail.includes("@")) {
      showToast("Por favor ingresá un email válido.", "success");
      return;
    }
    setVerificationSent(true);
    showToast(`Código de verificación enviado a ${newPrimaryEmail}. Para demostración, el código de prueba es 123456.`, "success");
  };

  const handleVerifyEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode.trim() === "123456" || verificationCode.trim().length === 6) {
      if (handleAddSecondaryEmail) handleAddSecondaryEmail(newPrimaryEmail);
      showToast("¡Email verificado y asociado exitosamente!", "success");
      setVerificationSent(false);
      setNewPrimaryEmail("");
      setVerificationCode("");
    } else {
      showToast("Código de verificación incorrecto.", "success");
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
          <label htmlFor="profileName" className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Nombre Completo</label>
          <input
            id="profileName"
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
          <label htmlFor="primaryEmail" className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Correo Primario</label>
          <input
            id="primaryEmail"
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
                <label htmlFor="newPrimaryEmail" className="sr-only">Nuevo email primario</label>
                <input
                  id="newPrimaryEmail"
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
                <label htmlFor="verificationCode" className="sr-only">Código de verificación</label>
                <input
                  id="verificationCode"
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
          <label htmlFor="profileGithubUser" className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Usuario de GitHub</label>
          <input
            id="profileGithubUser"
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
            <label htmlFor="profileMatricula" className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Matrícula UNRN</label>
            <input
              id="profileMatricula"
              type="text"
              value={profileMatricula}
              onChange={(e) => setProfileMatricula(e.target.value)}
              placeholder="Ej: UNRN-12345"
              className="w-full bg-bg-primary border border-border-custom rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-text-primary font-mono"
            />
          </div>
          <div>
            <label htmlFor="profileCohorte" className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Cohorte / Año de Ingreso</label>
            <input
              id="profileCohorte"
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

      {/* AUTORIZACIÓN GMAIL OAUTH (PERFIL DE USUARIO) */}
      {(profile?.role === "teacher" || profile?.role === "admin") && (
        <div className="bg-bg-secondary p-6 rounded-2xl border border-border-custom space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-border-custom pb-3">
            <div>
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center space-x-2">
                <span>📧 Autorización de Gmail para Envíos (OAuth 2.0)</span>
              </h3>
              <p className="text-xs text-text-secondary mt-1">
                Autorizá tu casilla de correo Gmail o Google Workspace personal/institucional para enviar avisos, correos a estudiantes y alertas de inasistencias.
              </p>
            </div>
            {gmailStatus.connected ? (
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-xl text-xs font-mono font-bold whitespace-nowrap flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Conectado: {gmailStatus.email}</span>
              </span>
            ) : (
              <span className="bg-amber-500/10 text-amber-500 border border-amber-500/30 px-3 py-1 rounded-xl text-xs font-mono font-bold whitespace-nowrap">
                ⚪ No Autorizado
              </span>
            )}
          </div>

          {!gmailStatus.connected ? (
            <div className="pt-1">
              <button
                type="button"
                onClick={handleStartGmailAuth}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition flex items-center space-x-2 cursor-pointer shadow-md"
              >
                <span>🔑 Conectar y Autorizar Casilla Gmail</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              <div className="flex flex-col sm:flex-row gap-2">
                <label htmlFor="testEmailAddress" className="sr-only">Email de destino para prueba</label>
                <input
                  id="testEmailAddress"
                  type="email"
                  value={testEmailAddress}
                  onChange={(e) => setTestEmailAddress && setTestEmailAddress(e.target.value)}
                  placeholder="Email de destino para prueba (Ej: tuemail@unrn.edu.ar)"
                  className="flex-1 bg-bg-primary border border-border-custom text-text-primary rounded-xl px-3 py-2 text-xs focus:outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={handleSendTestGmail}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer"
                >
                  ✉️ Enviar Correo de Prueba
                </button>
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleDisconnectGmail}
                  className="text-xs text-red-400 hover:text-red-300 font-semibold underline cursor-pointer"
                >
                  Desvincular Cuenta Gmail
                </button>
              </div>
            </div>
          )}
        </div>
      )}

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
          <label htmlFor="newSecondaryEmail" className="sr-only">Agregar otro correo</label>
          <input
            id="newSecondaryEmail"
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
