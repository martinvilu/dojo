import { NextResponse } from "next/server";
import { adminDb, requireCourseSubscriptionToken } from "../../middleware/api";
// Mismo motor que la callable `api`: una sola definición de la condición académica.
import { loadCourseAcademicData, computeConditions } from "../../../../../functions/src/lib/academic/loader";

export const dynamic = "force-dynamic";

/**
 * Unified CSV export endpoint for external spreadsheets (Google Sheets /
 * Excel). Replaces the former `exportGradesCsv` / `exportAttendanceCsv`
 * cloud functions behind the same per-course sync_secret token scheme.
 *
 *   GET /api/export/csv?courseId=X&token=Y&type=grades|attendance|roster|cursada
 *
 * `cursada` es la planilla institucional (SPEC §3.3): matrícula, nombre,
 * email, comisión, nota de cada TP y parcial, promedio, asistencia, alertas
 * y condición.
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

  return { body: csv, filename: `asistencia_${String(course.name || "").replace(/\s+/g, "_")}.csv` };
}

async function buildRosterCsv(db: any, courseId: string, course: any): Promise<CsvResult> {
  const data = await loadCourseAcademicData(db, courseId);
  const results = computeConditions(data);

  let csv = "matricula;estudiante_nombre;estudiante_email;usuario_github;estado_roster;asistencia_porcentaje;entregas_completadas;estado_riesgo\n";

  for (const r of results) {
    const student = data.students.find((s: any) => s.id === r.student_id);
    const profile = student?.profile || {};
    csv += [
      escapeCsv(profile.matricula_unrn || ""),
      escapeCsv(profile.full_name || ""),
      escapeCsv(profile.email || ""),
      escapeCsv(profile.github_username || profile.github_user || ""),
      escapeCsv(student?.rosterStatus || "approved"),
      r.attendance.ratio === null ? "" : `${Math.round(r.attendance.ratio * 100)}%`,
      `${r.tps.delivered}/${r.tps.required}`,
      escapeCsv(r.condition),
    ].join(";") + "\n";
  }

  return { body: csv, filename: `alumnos_alertas_${String(course.name || "").replace(/\s+/g, "_")}.csv` };
}

const csvNumber = (n: number | null) => (n === null ? "" : String(Math.round(n * 100) / 100).replace(".", ","));

async function buildCursadaCsv(db: any, courseId: string, course: any): Promise<CsvResult> {
  const data = await loadCourseAcademicData(db, courseId);
  const results = computeConditions(data);
  const assignments = data.assignments.filter((a: any) => !a.is_archived);
  const assessments = data.assessments.filter((a: any) => !a.archived);

  const header = [
    "matricula", "nombre", "email", "comision",
    ...assignments.map((a: any) => `TP ${a.title || a.id}`),
    ...assessments.map((a: any) => a.label || a.id),
    "promedio", "asistencia", "alertas", "condicion",
  ];
  let csv = header.map((h) => escapeCsv(String(h))).join(";") + "\n";

  for (const r of results) {
    const subs: Record<string, any> = (data.submissionsByStudent as Record<string, any>)[r.student_id] || {};
    const grades: Record<string, any> = (data.gradesByStudent as Record<string, any>)[r.student_id] || {};
    const tpCells = assignments.map((a: any) => String(subs[a.id]?.grade ?? ""));
    const assessmentCells = assessments.map((a: any) => (grades[a.id]?.absent ? "Ausente" : String(grades[a.id]?.grade ?? "")));
    // Promedio de notas numéricas: TPs y la mejor nota de cada parcial (con su recuperatorio).
    const numeric = [
      ...tpCells.map((g: string) => Number(g.replace(",", "."))),
      ...r.partials.map((p: any) => (p.best === null ? NaN : p.best)),
    ].filter((n) => isGrade(n));
    const average = numeric.length ? numeric.reduce((a, b) => a + b, 0) / numeric.length : null;

    csv += [
      escapeCsv(r.matricula_unrn || ""),
      escapeCsv(r.full_name || ""),
      escapeCsv(r.email || ""),
      escapeCsv(r.commission || ""),
      ...tpCells.map(escapeCsv),
      ...assessmentCells.map(escapeCsv),
      csvNumber(average),
      r.attendance.ratio === null ? "" : `${Math.round(r.attendance.ratio * 100)}%`,
      escapeCsv(r.reasons.join(" | ")),
      escapeCsv(r.condition),
    ].join(";") + "\n";
  }

  return { body: csv, filename: `cursada_${String(course.name || courseId).replace(/\s+/g, "_")}.csv` };
}

function isGrade(n: number): boolean {
  return Number.isFinite(n) && n >= 0 && n <= 10;
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
    } else if (type === "cursada" || type === "planilla") {
      result = await buildCursadaCsv(db, courseId, course);
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
