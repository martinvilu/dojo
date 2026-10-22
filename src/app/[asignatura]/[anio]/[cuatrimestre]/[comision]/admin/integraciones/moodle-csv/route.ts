import { NextResponse } from "next/server";
import { callApi, errorResponse, resolveRoute } from "@/lib/server/callableProxy";
import { parseMoodleLogCsv } from "@/modules/moodle/utils/moodleLogCsv";

type Params = { asignatura: string; anio: string; cuatrimestre: string; comision: string };
const BATCH_SIZE = 1000;
const MAX_BYTES = 15 * 1024 * 1024;

/** POST …/admin/integraciones/moodle-csv — body: el CSV de logs de Moodle (text/csv). */
export async function POST(request: Request, { params }: { params: Promise<Params> }) {
  try {
    const { courseId } = await resolveRoute(request, await params);
    const text = await request.text();
    if (text.length > MAX_BYTES) return NextResponse.json({ error: "El archivo supera los 15 MB; dividilo por período." }, { status: 413 });
    let parsed;
    try {
      parsed = parseMoodleLogCsv(text);
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const totals = { received: parsed.events.length, inserted: 0, duplicates: 0, skippedRows: parsed.skipped };
    for (let i = 0; i < parsed.events.length; i += BATCH_SIZE) {
      const r = await callApi(request, "importMoodleLogs", { courseId, events: parsed.events.slice(i, i + BATCH_SIZE) });
      totals.inserted += r.inserted;
      totals.duplicates += r.duplicates;
    }
    return NextResponse.json(totals);
  } catch (error) {
    return errorResponse(error);
  }
}
