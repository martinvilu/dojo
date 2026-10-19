"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { showToast } from "@/components/dashboard/ui/ToastNotification";
import { confirmAction } from "@/components/dashboard/ui/ConfirmDialog";

/**
 * Derechos sobre los datos personales (mejora 3.49): descarga de todos los
 * datos de la cuenta y pedido de baja, que ejecuta un administrador.
 */
export default function DataPrivacySection({ deletionRequested: initialRequested = false }: { deletionRequested?: boolean }) {
  const [exporting, setExporting] = useState(false);
  const [requested, setRequested] = useState(initialRequested);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await api("exportMyData");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mis-datos-ninja-dojo-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      showToast("No se pudieron exportar tus datos: " + err.message, "error");
    } finally {
      setExporting(false);
    }
  };

  const handleRequestDeletion = async () => {
    const ok = await confirmAction({
      message: "¿Pedir la baja de tu cuenta? Un administrador la va a ejecutar y se borrarán tu acceso, tu perfil y tus inscripciones. Antes conviene descargar tus datos.",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api("requestAccountDeletion", { reason });
      setRequested(true);
      showToast("Pedido de baja enviado. Podés cancelarlo mientras no se ejecute.", "success");
    } catch (err: any) {
      showToast("No se pudo registrar el pedido: " + err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    setBusy(true);
    try {
      await api("cancelAccountDeletion");
      setRequested(false);
      showToast("Cancelaste el pedido de baja.", "success");
    } catch (err: any) {
      showToast("No se pudo cancelar el pedido: " + err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="privacy-title" className="space-y-4">
      <h3 id="privacy-title" className="text-sm font-bold text-text-primary uppercase tracking-wider border-b border-border-custom pb-2">
        📦 Tus datos personales
      </h3>
      <p className="text-xs text-text-secondary">
        Podés descargar todo lo que la plataforma guarda de tu cuenta: perfil, inscripciones, entregas y notas, asistencia, mensajes del foro, revisiones, tutorías, XP, notificaciones y accesos.
      </p>
      <button
        type="button"
        onClick={handleExport}
        disabled={exporting}
        className="px-4 py-2 bg-bg-tertiary hover:bg-bg-primary border border-border-custom rounded-xl text-xs font-semibold text-text-primary transition cursor-pointer disabled:opacity-50"
      >
        {exporting ? "Preparando…" : "📥 Descargar mis datos (JSON)"}
      </button>

      <div className="pt-2 border-t border-border-custom space-y-2">
        {requested ? (
          <>
            <p className="text-xs text-amber-400 font-semibold" role="status">Pediste la baja de tu cuenta. Un administrador la va a procesar.</p>
            <button type="button" onClick={handleCancel} disabled={busy} className="px-4 py-2 border border-border-custom rounded-xl text-xs font-semibold text-text-primary hover:bg-bg-tertiary cursor-pointer disabled:opacity-50">
              Cancelar pedido de baja
            </button>
          </>
        ) : (
          <>
            <label htmlFor="deletionReason" className="block text-xs font-semibold text-text-secondary">Motivo (opcional)</label>
            <textarea
              id="deletionReason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={1000}
              rows={2}
              className="w-full bg-bg-primary border border-border-custom rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-blue-500"
            />
            <button type="button" onClick={handleRequestDeletion} disabled={busy} className="px-4 py-2 bg-red-950/40 hover:bg-red-900/50 border border-red-900/60 rounded-xl text-xs font-semibold text-red-300 cursor-pointer disabled:opacity-50">
              Pedir la baja de mi cuenta
            </button>
          </>
        )}
      </div>
    </section>
  );
}
