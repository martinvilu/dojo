import { NextResponse } from "next/server";
import { adminDb, requireCourseSubscriptionToken } from "../../middleware/api";
import { buildAttendanceCsv, buildGradesCsv, buildRosterCsv, type CsvResult } from "@/lib/csvExport";

export const dynamic = "force-dynamic";

/**
 * Unified CSV export endpoint for external spreadsheets (Google Sheets /
 * Excel). Replaces the former `exportGradesCsv` / `exportAttendanceCsv`
 * cloud functions behind the same per-course sync_secret token scheme.
 *
 *   GET /api/export/csv?courseId=X&token=Y&type=grades|attendance|roster
 *
 * `id` is accepted as an alias of `courseId`, and legacy `type` values
 * (`asistencia`, `alertas`, `alumnos`) keep working.
 */



export async function GET(request: Request) {
  const sub = await requireCourseSubscriptionToken(request);
  if (sub instanceof NextResponse) return sub;
  const { courseId, course } = sub;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "grades";

  try {
    const db = adminDb();

    let result: CsvResult;
    if (type === "attendance" || type === "asistencia") {
      result = await buildAttendanceCsv(db, courseId, course);
    } else if (type === "roster" || type === "alertas" || type === "alumnos") {
      result = await buildRosterCsv(db, courseId, course);
    } else {
      result = await buildGradesCsv(db, courseId, course);
    }

    return new Response(result.body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "private, no-store"
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error al generar el CSV: " + error.message },
      { status: 500 }
    );
  }
}
