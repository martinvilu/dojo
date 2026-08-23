"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { showToast } from "@/components/dashboard/ui/ToastNotification";

interface UseBackupsArgs {
  setApiLoading: (v: boolean) => void;
}

/**
 * Admin-side system backups: creation, JSON download and single-document
 * restore. The initial listing is loaded by the dashboard orchestrator via
 * the exposed setSystemBackups.
 */
export function useBackups({ setApiLoading }: UseBackupsArgs) {
  const [systemBackups, setSystemBackups] = useState<any[]>([]);

  const handleCreateBackup = async () => {
    setApiLoading(true);
    try {
      const res = await api("createSystemBackup");
      showToast("Respaldo creado correctamente con ID: " + res.backupId, "success");
      const backupsRes = await api("getSystemBackups");
      setSystemBackups(backupsRes || []);
    } catch (err: any) {
      showToast("Error al crear respaldo: " + err.message, "error");
    } finally {
      setApiLoading(false);
    }
  };

  const handleDownloadBackup = async (backupId: string) => {
    setApiLoading(true);
    try {
      const data = await api("downloadSystemBackup", { backupId });
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `backup-${backupId}-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      showToast("Error al descargar respaldo: " + err.message, "error");
    } finally {
      setApiLoading(false);
    }
  };

  const handleRestoreBackupDocument = async (backupId: string, collectionName: string, docId: string) => {
    if (!confirm(`¿Seguro que querés restaurar el documento ${docId} de la colección ${collectionName}? Sobrescribirá los datos actuales en la base de datos remota.`)) return;
    setApiLoading(true);
    try {
      await api("restoreBackupDocument", { backupId, collectionName, docId });
      showToast("Documento restaurado con éxito.", "success");
    } catch (err: any) {
      showToast("Error al restaurar documento: " + err.message, "error");
    } finally {
      setApiLoading(false);
    }
  };

  return {
    systemBackups,
    setSystemBackups,
    handleCreateBackup,
    handleDownloadBackup,
    handleRestoreBackupDocument
  };
}
