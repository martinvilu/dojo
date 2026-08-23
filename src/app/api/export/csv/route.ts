import { NextResponse } from "next/server";
import { adminDb, requireCourseSubscriptionToken } from "../../middleware/api";

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

type CsvResult = { body: string; filename: string };

function escapeCsv(value: unknown): string {
  if (typeof value !== "string") return "";
  if (value.includes(";") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toIso(value: any): string {
  if (!value) return "";
  return value.toDate ? value.toDate().toISOString() : new Date(value).toISOString();
}

async function buildAttendanceCsv(db: any, courseId: string, course: any): Promise<CsvResult> {
  const studentIds = new Set<string>();

  const rosterSnap = await db.collection("course_roster").where("course_id", "==", courseId).get();
  rosterSnap.docs.forEach((doc: any) => {
    const data = doc.data();
    if (data.student_id) studentIds.add(data.student_id);
  });

  const enrollSnap = await db.collection("enrollments").get();
  enrollSnap.docs.forEach((doc: any) => {
    if (doc.id.includes(`_${courseId}`)) {
      const data = doc.data();
      if (data.student_id) studentIds.add(data.student_id);
    }
  });

  const profilesMap: Record<string, any> = {};
  for (const sid of Array.from(studentIds)) {
    const pSnap = await db.collection("profiles").doc(sid).get();
    if (pSnap.exists) profilesMap[sid] = pSnap.data();
  }

  const attCollSnap = await db.collection("courses").doc(courseId).collection("attendance").get();
  const globalAttSnap = await db.collection("attendance").where("course_id", "==", courseId).get();

  let csv = "timestamp;materia;clase;estudiante_email;estudiante_nombre;estudiante_matricula;usuario_github;estado\n";

  attCollSnap.docs.forEach((doc: any) => {
    const data = doc.data();
    const classNum = data.classNumber || doc.id.replace("class_", "");
    const records = data.records || {};
    const timestamp = toIso(data.updated_at) || new Date().toISOString();

    for (const [sid, status] of Object.entries(records)) {
      const profile = profilesMap[sid] || {};
      csv += [
        escapeCsv(timestamp),
        escapeCsv(course.name),
        escapeCsv(String(classNum)),
        escapeCsv(profile.email || profile.contact_email || ""),
        escapeCsv(profile.full_name || ""),
        escapeCsv(profile.matricula_unrn || ""),
        escapeCsv(profile.github_username || profile.github_user || ""),
        escapeCsv(String(status)),
      ].join(";") + "\n";
    }
  });

  globalAttSnap.docs.forEach((doc: any) => {
    const data = doc.data();
    const classId = data.class_id || data.classNumber || "1";
    const timestamp = toIso(data.timestamp) || new Date().toISOString();
    const profile = profilesMap[data.student_id] || {};

    csv += [
      escapeCsv(timestamp),
      escapeCsv(course.name),
      escapeCsv(String(classId)),
      escapeCsv(profile.email || profile.contact_email || ""),
      escapeCsv(profile.full_name || ""),
      escapeCsv(profile.matricula_unrn || ""),
      escapeCsv(profile.github_username || profile.github_user || ""),
      "presente",
    ].join(";") + "\n";
  });

  return { body: csv, filename: `asistencia_${String(course.name || "").replace(/\s+/g, "_")}.csv` };
}

async function buildRosterCsv(db: any, courseId: string, course: any): Promise<CsvResult> {
  const rosterSnap = await db.collection("course_roster").where("course_id", "==", courseId).get();
  const classes = course.class_instances || [];
  const totalClasses = classes.length || 1;

  const assignSnap = await db.collection("assignments").where("course_id", "==", courseId).get();
  const totalAssignments = assignSnap.docs.length || 1;

  let csv = "matricula;estudiante_nombre;estudiante_email;usuario_github;estado_roster;asistencia_porcentaje;entregas_completadas;estado_riesgo\n";

  for (const doc of rosterSnap.docs) {
    const rData = doc.data();
    const sid = rData.student_id;
    const pSnap = await db.collection("profiles").doc(sid).get();
    const profile = pSnap.exists ? pSnap.data() : {};

    const attSnap = await db
      .collection("attendance")
      .where("course_id", "==", courseId)
      .where("student_id", "==", sid)
      .get();
    const presentCount = attSnap.docs.length;
    const attRatio = Math.round((presentCount / Math.max(totalClasses, 1)) * 100);

    const subSnap = await db.collection("submissions").where("student_id", "==", sid).get();
    const subCount = subSnap.docs.length;

    const isRisk = (attRatio < 75 && totalClasses >= 3) || subCount < Math.ceil(totalAssignments * 0.5);

    csv += [
      escapeCsv(profile.matricula_unrn || ""),
      escapeCsv(profile.full_name || ""),
      escapeCsv(profile.email || ""),
      escapeCsv(profile.github_username || profile.github_user || ""),
      escapeCsv(rData.status || "approved"),
      `${attRatio}%`,
      `${subCount}/${totalAssignments}`,
      isRisk ? "EN RIESGO" : "REGULAR",
    ].join(";") + "\n";
  }

  return { body: csv, filename: `alumnos_alertas_${String(course.name || "").replace(/\s+/g, "_")}.csv` };
}

async function buildGradesCsv(db: any, courseId: string, course: any): Promise<CsvResult> {
  const aSnap = await db.collection("assignments").where("course_id", "==", courseId).get();
  const assignmentsMap: Record<string, any> = {};
  aSnap.docs.forEach((d: any) => (assignmentsMap[d.id] = d.data()));

  let csv = "timestamp;id_entrega;email;practica-usuario;url_repositorio;comentarios_entrega;materia;practica;usuario_github\n";

  for (const aId of Object.keys(assignmentsMap)) {
    const assignment = assignmentsMap[aId];
    const sSnap = await db.collection("submissions").where("assignment_id", "==", aId).get();

    for (const doc of sSnap.docs) {
      const sub = doc.data();
      const pSnap = await db.collection("profiles").doc(sub.student_id).get();
      const profile = pSnap.exists ? pSnap.data() : {};

      csv += [
        toIso(sub.created_at),
        doc.id,
        escapeCsv(profile.contact_email || profile.email || ""),
        escapeCsv(`${assignment.title} - ${profile.full_name || ""}`),
        escapeCsv(sub.repo_url || ""),
        escapeCsv(sub.feedback || ""),
        escapeCsv(course.name),
        escapeCsv(assignment.title),
        escapeCsv(profile.github_username || ""),
      ].join(";") + "\n";
    }
  }

  return { body: csv, filename: `export_${courseId}.csv` };
}

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
