/**
 * Generación de los CSV de /api/export/csv (Google Sheets / Excel).
 * Lecturas acotadas al curso y por lotes: roster e inscripciones por
 * course_id, entregas con consultas `in` de 30 tareas y perfiles en un único
 * getAll.
 */
export type CsvResult = { body: string; filename: string };

export function escapeCsv(value: unknown): string {
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

const IN_LIMIT = 30;

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Perfiles en una sola lectura por lotes (getAll). */
export async function loadProfiles(db: any, ids: string[]): Promise<Map<string, any>> {
  if (ids.length === 0) return new Map();
  const snaps = await db.getAll(...ids.map((id) => db.collection("profiles").doc(id)));
  return new Map(snaps.map((snap: any, i: number) => [ids[i], snap.exists ? snap.data() : {}]));
}

/** Estudiantes del curso (roster + inscripciones), sin escanear toda la colección. */
export async function courseStudentIds(db: any, courseId: string): Promise<{ ids: string[]; rosterStatus: Map<string, string> }> {
  const [rosterSnap, enrollSnap] = await Promise.all([
    db.collection("course_roster").where("course_id", "==", courseId).get(),
    db.collection("enrollments").where("course_id", "==", courseId).get(),
  ]);
  const rosterStatus = new Map<string, string>();
  rosterSnap.docs.forEach((d: any) => d.data().student_id && rosterStatus.set(d.data().student_id, d.data().status || "approved"));
  enrollSnap.docs.forEach((d: any) => {
    const sid = d.data().student_id;
    if (sid && !rosterStatus.has(sid)) rosterStatus.set(sid, d.data().status || "approved");
  });
  return { ids: [...rosterStatus.keys()], rosterStatus };
}

export async function courseSubmissions(db: any, assignmentIds: string[]): Promise<any[]> {
  const subs: any[] = [];
  for (const group of chunk(assignmentIds, IN_LIMIT)) {
    const snap = await db.collection("submissions").where("assignment_id", "in", group).get();
    snap.docs.forEach((d: any) => subs.push({ id: d.id, ...d.data() }));
  }
  return subs;
}

const studentEmail = (p: any) => p.email || p.contact_email || "";
const githubUser = (p: any) => p.github_username || p.github_user || "";

export async function buildAttendanceCsv(db: any, courseId: string, course: any): Promise<CsvResult> {
  const [{ ids }, attSnap] = await Promise.all([
    courseStudentIds(db, courseId),
    db.collection("courses").doc(courseId).collection("attendance").get(),
  ]);
  const recorded = new Set<string>(ids);
  attSnap.docs.forEach((d: any) => Object.keys(d.data().records || {}).forEach((sid) => recorded.add(sid)));
  const profiles = await loadProfiles(db, [...recorded]);

  let csv = "timestamp;materia;clase;estudiante_email;estudiante_nombre;estudiante_matricula;usuario_github;estado\n";
  attSnap.docs.forEach((doc: any) => {
    const data = doc.data();
    const classNum = data.classNumber || doc.id.replace("class_", "");
    const timestamp = toIso(data.updated_at) || new Date().toISOString();
    for (const [sid, status] of Object.entries(data.records || {})) {
      const profile = profiles.get(sid) || {};
      csv += [
        escapeCsv(timestamp),
        escapeCsv(course.name),
        escapeCsv(String(classNum)),
        escapeCsv(studentEmail(profile)),
        escapeCsv(profile.full_name || ""),
        escapeCsv(profile.matricula_unrn || ""),
        escapeCsv(githubUser(profile)),
        escapeCsv(String(status)),
      ].join(";") + "\n";
    }
  });

  return { body: csv, filename: `asistencia_${String(course.name || "").replace(/\s+/g, "_")}.csv` };
}

export async function buildRosterCsv(db: any, courseId: string, course: any): Promise<CsvResult> {
  const [{ ids, rosterStatus }, assignSnap, attSnap] = await Promise.all([
    courseStudentIds(db, courseId),
    db.collection("assignments").where("course_id", "==", courseId).get(),
    db.collection("courses").doc(courseId).collection("attendance").get(),
  ]);
  const assignments: any[] = assignSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
  const now = Date.now();
  const pastDue = new Set<string>(assignments.filter((a: any) => a.due_date && new Date(a.due_date).getTime() < now).map((a: any) => String(a.id)));
  const [profiles, subs] = await Promise.all([loadProfiles(db, ids), courseSubmissions(db, assignments.map((a: any) => a.id))]);
  const submittedBy = new Map<string, Set<string>>();
  subs.forEach((s) => {
    if (!submittedBy.has(s.student_id)) submittedBy.set(s.student_id, new Set());
    submittedBy.get(s.student_id)!.add(s.assignment_id);
  });
  const records = attSnap.docs.map((d: any) => d.data().records || {});

  let csv = "matricula;estudiante_nombre;estudiante_email;usuario_github;estado_roster;asistencia_porcentaje;entregas_completadas;estado_riesgo\n";
  for (const sid of ids) {
    const profile = profiles.get(sid) || {};
    // Misma regla que las alertas del panel: asistencia crítica (< 75 %
    // con al menos 3 clases registradas) o tareas vencidas sin entrega.
    const recordedCount = records.filter((r: any) => r[sid]).length;
    const present = records.filter((r: any) => r[sid] === "present" || r[sid] === "late").length;
    const attRatio = recordedCount ? Math.round((present / recordedCount) * 100) : 100;
    const mine = submittedBy.get(sid) || new Set<string>();
    const missingPastDue = [...pastDue].some((aid) => !mine.has(aid));
    const isRisk = (recordedCount >= 3 && attRatio < 75) || missingPastDue;

    csv += [
      escapeCsv(profile.matricula_unrn || ""),
      escapeCsv(profile.full_name || ""),
      escapeCsv(profile.email || ""),
      escapeCsv(githubUser(profile)),
      escapeCsv(rosterStatus.get(sid) || "approved"),
      `${attRatio}%`,
      `${mine.size}/${assignments.length}`,
      isRisk ? "EN RIESGO" : "REGULAR",
    ].join(";") + "\n";
  }

  return { body: csv, filename: `alumnos_alertas_${String(course.name || "").replace(/\s+/g, "_")}.csv` };
}

export async function buildGradesCsv(db: any, courseId: string, course: any): Promise<CsvResult> {
  const aSnap = await db.collection("assignments").where("course_id", "==", courseId).get();
  const assignments = new Map<string, any>(aSnap.docs.map((d: any) => [d.id, d.data()]));
  const subs = await courseSubmissions(db, [...assignments.keys()]);
  const profiles = await loadProfiles(db, [...new Set(subs.map((s) => s.student_id).filter(Boolean))]);

  let csv = "timestamp;id_entrega;email;practica-usuario;url_repositorio;comentarios_entrega;materia;practica;usuario_github\n";
  for (const sub of subs) {
    const assignment = assignments.get(sub.assignment_id) || {};
    const profile = profiles.get(sub.student_id) || {};
    csv += [
      toIso(sub.created_at),
      sub.id,
      escapeCsv(profile.contact_email || profile.email || ""),
      escapeCsv(`${assignment.title} - ${profile.full_name || ""}`),
      escapeCsv(sub.repo_url || ""),
      escapeCsv(sub.feedback || ""),
      escapeCsv(course.name),
      escapeCsv(assignment.title),
      escapeCsv(githubUser(profile)),
    ].join(";") + "\n";
  }

  return { body: csv, filename: `export_${courseId}.csv` };
}

