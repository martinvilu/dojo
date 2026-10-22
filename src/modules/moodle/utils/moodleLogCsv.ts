/**
 * Parser de los logs CSV que exporta Moodle (Informes → Registros), en
 * castellano o inglés. Extrae el ID de usuario de la columna Descripción
 * (`user with id '19284'`) y normaliza la hora a milisegundos (UTC-3).
 */

export interface MoodleLogEvent {
  userId: string;
  time: string;
  timeMs: number | null;
  eventName: string;
  context: string;
  component: string;
}

export interface MoodleLogParseResult {
  events: MoodleLogEvent[];
  rows: number;
  skipped: number;
}

const USER_ID_RE = /user with id '(\d+)'/i;

const HEADERS: Record<keyof Omit<MoodleLogEvent, "userId" | "timeMs"> | "description", string[]> = {
  time: ["hora", "time"],
  eventName: ["nombre evento", "nombre del evento", "event name"],
  context: ["contexto del evento", "event context"],
  component: ["componente", "component"],
  description: ["descripción", "descripcion", "description"],
};

/** CSV con comillas dobles y separador `,` o `;` (detectado en la cabecera). */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.slice(0, clean.indexOf("\n") >= 0 ? clean.indexOf("\n") : clean.length);
  const sep = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

/** "10/06/26, 10:00" o "10/06/2026 10:00:15" → ms en hora argentina. */
export function parseMoodleTime(value: string): number | null {
  const m = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : ms;
  }
  const [, d, mo, y, h, mi, s] = m;
  const year = y.length === 2 ? 2000 + Number(y) : Number(y);
  const iso = `${year}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}T${h.padStart(2, "0")}:${mi}:${(s || "00").padStart(2, "0")}-03:00`;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

export function parseMoodleLogCsv(text: string): MoodleLogParseResult {
  const [header, ...rows] = parseCsv(text);
  if (!header) return { events: [], rows: 0, skipped: 0 };
  const normalized = header.map((h) => h.trim().toLowerCase());
  const col = (names: string[]) => normalized.findIndex((h) => names.includes(h));
  const idx = {
    time: col(HEADERS.time),
    eventName: col(HEADERS.eventName),
    context: col(HEADERS.context),
    component: col(HEADERS.component),
    description: col(HEADERS.description),
  };
  if (idx.time < 0 || idx.description < 0) {
    throw new Error("El archivo no parece un log de Moodle: faltan las columnas Hora y Descripción.");
  }

  const events: MoodleLogEvent[] = [];
  let skipped = 0;
  for (const row of rows) {
    const match = (row[idx.description] || "").match(USER_ID_RE);
    const time = (row[idx.time] || "").trim();
    if (!match || !time) { skipped++; continue; }
    events.push({
      userId: match[1],
      time,
      timeMs: parseMoodleTime(time),
      eventName: (idx.eventName >= 0 ? row[idx.eventName] : "").trim().slice(0, 300),
      context: (idx.context >= 0 ? row[idx.context] : "").trim().slice(0, 500),
      component: (idx.component >= 0 ? row[idx.component] : "").trim().slice(0, 200),
    });
  }
  return { events, rows: rows.length, skipped };
}
