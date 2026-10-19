/**
 * Acta de regularidades para SIU Guaraní (mejora 3.43): condición de cada
 * estudiante de la cátedra a partir de la asistencia y las notas cargadas.
 *
 * REGULAR si la asistencia (presentes + tardes sobre clases registradas)
 * alcanza `minAttendance` y todas las tareas tienen nota numérica igual o
 * mayor a `minGrade` (o conceptual "Aprobado"/"Promocionado"); LIBRE en
 * cualquier otro caso. Los umbrales son parámetros para adaptarse al
 * régimen de cada materia.
 */
import { createHmac } from "node:crypto";
import { courseStudentIds, courseSubmissions, loadProfiles } from "./csvExport.ts";

export interface ActaCriteria {
  minAttendance: number;
  minGrade: number;
}

const APPROVED_WORDS = /^(aprobad[oa]|promocionad[oa])$/i;

function gradeValue(grade: unknown): number | "approved" | null {
  if (grade === null || grade === undefined || grade === "") return null;
  const text = String(grade).trim();
  if (APPROVED_WORDS.test(text)) return "approved";
  const n = Number(text.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export async function buildRegularityActa(db: any, courseId: string, course: any, criteria: ActaCriteria) {
  const [{ ids }, assignSnap, attSnap] = await Promise.all([
    courseStudentIds(db, courseId),
    db.collection("assignments").where("course_id", "==", courseId).get(),
    db.collection("courses").doc(courseId).collection("attendance").get(),
  ]);
  const assignments: string[] = assignSnap.docs.map((d: any) => d.id);
  const [profiles, subs] = await Promise.all([loadProfiles(db, ids), courseSubmissions(db, assignments)]);
  const records = attSnap.docs.map((d: any) => d.data().records || {});
  const gradeOf = new Map<string, unknown>(subs.map((s) => [`${s.student_id}|${s.assignment_id}`, s.grade]));

  const students = ids.map((sid) => {
    const p = profiles.get(sid) || {};
    const recorded = records.filter((r: any) => r[sid]).length;
    const present = records.filter((r: any) => r[sid] === "present" || r[sid] === "late").length;
    const attendance = recorded ? Math.round((present / recorded) * 100) : 0;
    const values = assignments.map((aid: string) => gradeValue(gradeOf.get(`${sid}|${aid}`)));
    const passed = values.filter((v: any) => v === "approved" || (typeof v === "number" && v >= criteria.minGrade)).length;
    const numeric = values.filter((v: any): v is number => typeof v === "number");
    const average = numeric.length ? Math.round((numeric.reduce((a: number, b: number) => a + b, 0) / numeric.length) * 100) / 100 : null;
    const regular = attendance >= criteria.minAttendance && passed === assignments.length;
    return {
      legajo: p.matricula_unrn || null,
      nombre: p.full_name || null,
      email: p.email || null,
      asistencia_pct: attendance,
      clases_registradas: recorded,
      tareas_aprobadas: passed,
      tareas_totales: assignments.length,
      promedio: average,
      condicion: regular ? "REGULAR" : "LIBRE",
    };
  }).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es"));

  return {
    version: 1,
    materia: { id: courseId, nombre: course.name || null },
    generado: new Date().toISOString(),
    criterios: { asistencia_minima_pct: criteria.minAttendance, nota_minima: criteria.minGrade },
    estudiantes: students,
  };
}

/** Firma HMAC-SHA256 del cuerpo para que el receptor verifique integridad. */
export function signActa(body: string, secret: string): string {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}
