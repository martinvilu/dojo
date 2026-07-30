import React from "react";
import { useGmailAuth } from "../hooks/useGmailAuth";

export default function GmailIntegrationCard({ 
  gmailStatus, 
  handleStartAuth, 
  handleDisconnect, 
  handleSendTest 
}: { 
  gmailStatus: { connected: boolean; email: string | null };
  handleStartAuth: () => void;
  handleDisconnect: () => void;
  handleSendTest: () => void;
}) {
  return (
    <div className="bg-bg-secondary border border-border-custom p-6 rounded-2xl flex flex-col justify-between items-start gap-4 hover:border-emerald-500/30 transition shadow-sm">
      <div className="flex gap-4 items-start w-full">
        <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-bold text-gray-200 flex items-center gap-2">
            <span>📧 Envío de Notificaciones por Gmail (Gmail API OAuth2)</span>
            {gmailStatus.connected ? (
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-mono border border-emerald-500/30">Conectado: {gmailStatus.email}</span>
            ) : (
              <span className="text-[10px] bg-gray-500/20 text-gray-400 px-2 py-0.5 rounded-full font-mono border border-gray-500/30">Desconectado</span>
            )}
          </h4>
          <p className="text-xs text-gray-400 mt-1">
            Autorizá tu cuenta de Gmail institucional o personal para enviar avisos, alertas de inasistencias y estados del curso directamente desde tu casilla oficial con 100% de entregabilidad a bandeja de entrada.
          </p>
        </div>
      </div>
      <div className="flex gap-3 mt-2 w-full justify-end">
        {!gmailStatus.connected ? (
          <button
            onClick={handleStartAuth}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-900/20"
          >
            <span>🔑 Autorizar y Vincular Cuenta Gmail</span>
          </button>
        ) : (
          <>
            <button
              onClick={handleSendTest}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-gray-200 rounded-xl text-xs font-bold transition border border-neutral-700"
            >
              <span>Prueba de Envío</span>
            </button>
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-2 px-4 py-2 bg-red-950/40 hover:bg-red-900/60 text-red-400 rounded-xl text-xs font-bold transition border border-red-900/30"
            >
              Desvincular Cuenta Gmail
            </button>
          </>
        )}
      </div>
    </div>
  );
}
