/// <reference lib="webworker" />
import { parseMoodleLogCsv } from "../utils/moodleLogCsv";

// Logs de un cuatrimestre pueden tener cientos de miles de filas: se
// parsean fuera del hilo principal para no congelar la interfaz.
self.onmessage = (event: MessageEvent<string>) => {
  try {
    self.postMessage({ ok: true, result: parseMoodleLogCsv(event.data) });
  } catch (err: any) {
    self.postMessage({ ok: false, error: err?.message || "No se pudo leer el archivo." });
  }
};
