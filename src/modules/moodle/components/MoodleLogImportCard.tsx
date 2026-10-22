"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { showToast } from "@/components/dashboard/ui/ToastNotification";
import { parseMoodleLogCsv, type MoodleLogParseResult } from "../utils/moodleLogCsv";

const BATCH_SIZE = 1000;

function parseInWorker(text: string): Promise<MoodleLogParseResult> {
  if (typeof Worker === "undefined") return Promise.resolve(parseMoodleLogCsv(text));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../workers/moodleLogs.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event) => {
      worker.terminate();
      if (event.data.ok) resolve(event.data.result);
      else reject(new Error(event.data.error));
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || "No se pudo leer el archivo."));
    };
    worker.postMessage(text);
  });
}

/**
 * Importa el log CSV de Moodle (Informes → Registros → Descargar). Es
 * idempotente: se puede subir el mismo período más de una vez.
 */
export default function MoodleLogImportCard({ courseId }: { courseId: string }) {
  const [progress, setProgress] = useState<string>("");
  const [summary, setSummary] = useState<string>("");

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setSummary("");
    try {
      setProgress("Leyendo el archivo…");
      const parsed = await parseInWorker(await file.text());
      if (parsed.events.length === 0) throw new Error("El archivo no tiene eventos con un usuario identificable.");

      let inserted = 0;
      let duplicates = 0;
      const unmatched = new Set<string>();
      for (let i = 0; i < parsed.events.length; i += BATCH_SIZE) {
        setProgress(`Importando ${Math.min(i + BATCH_SIZE, parsed.events.length)} de ${parsed.events.length} eventos…`);
        const res = await api("importMoodleLogs", { courseId, events: parsed.events.slice(i, i + BATCH_SIZE) });
        inserted += res.inserted;
        duplicates += res.duplicates;
        res.unmatchedUserIds.forEach((id: string) => unmatched.add(id));
      }
      setSummary(`${inserted} eventos nuevos, ${duplicates} ya importados, ${parsed.skipped} filas sin usuario.${unmatched.size ? ` ${unmatched.size} usuarios de Moodle no están vinculados a estudiantes del Dojo (todavía no ingresaron por LTI).` : ""}`);
      showToast("Logs de Moodle importados.", "success");
    } catch (err: any) {
      showToast("Error al importar: " + err.message, "error");
    } finally {
      setProgress("");
    }
  };

  return (
    <div className="bg-neutral-900/60 p-5 rounded-2xl border border-neutral-800 space-y-3">
      <div>
        <h3 className="text-sm font-bold text-gray-200">📥 Logs de actividad de Moodle (CSV)</h3>
        <p className="text-xs text-gray-400 mt-1">
          En Moodle: Informes → Registros → Descargar en CSV. Detecta a quienes siguen entrando al campus pero no arrancaron la práctica (deserción silenciosa).
        </p>
      </div>
      <input type="file" accept=".csv,text/csv" disabled={Boolean(progress)} aria-label="Archivo CSV de logs de Moodle"
        onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }}
        className="block text-xs text-gray-300 file:mr-3 file:px-3 file:py-2 file:rounded-xl file:border-0 file:bg-neutral-800 file:text-gray-200 file:font-semibold file:cursor-pointer" />
      {progress && <p className="text-xs text-gray-400" role="status">{progress}</p>}
      {summary && <p className="text-xs text-gray-300" aria-live="polite">{summary}</p>}
    </div>
  );
}
