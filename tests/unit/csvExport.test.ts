import { describe, it } from "node:test";
import assert from "node:assert";
import { buildAttendanceCsv, buildGradesCsv, buildRosterCsv, escapeCsv } from "../../src/lib/csvExport.ts";

function fakeDb(docs: Record<string, any>) {
  const reads: string[] = [];
  const matches = (d: any, [f, op, v]: any[]) => (op === "in" ? v.includes(d[f]) : d[f] === v);
  const coll = (prefix: string, filters: any[] = []): any => ({
    where: (f: string, op: string, v: any) => coll(prefix, [...filters, [f, op, v]]),
    doc: (id: string) => ({
      path: `${prefix}/${id}`,
      get: async () => ({ exists: `${prefix}/${id}` in docs, data: () => docs[`${prefix}/${id}`] }),
      collection: (n: string) => coll(`${prefix}/${id}/${n}`),
    }),
    get: async () => {
      reads.push(`${prefix}?${JSON.stringify(filters)}`);
      const keys = Object.keys(docs).filter((k) => k.startsWith(`${prefix}/`) && k.split("/").length === prefix.split("/").length + 1 && filters.every((fl) => matches(docs[k], fl)));
      return { docs: keys.map((k) => ({ id: k.split("/").pop(), data: () => docs[k] })) };
    },
  });
  return {
    reads,
    collection: (n: string) => coll(n),
    getAll: async (...refs: any[]) => refs.map((r) => ({ exists: r.path in docs, data: () => docs[r.path] })),
  };
}

const PAST = "2026-01-01T00:00:00Z";
const DOCS = {
  "course_roster/c1_s1": { course_id: "c1", student_id: "s1" },
  "enrollments/s2_c1": { course_id: "c1", student_id: "s2", status: "pending" },
  "enrollments/s9_c2": { course_id: "c2", student_id: "s9" },
  "profiles/s1": { full_name: "Ana", email: "ana@x", matricula_unrn: "UNRN-1", github_user: "ana" },
  "profiles/s2": { full_name: "Beto", email: "beto@x" },
  "assignments/a1": { course_id: "c1", title: "TP1", due_date: PAST },
  "assignments/b1": { course_id: "c2", title: "Ajena", due_date: PAST },
  "submissions/x1": { assignment_id: "a1", student_id: "s1", repo_url: "https://github.com/o/r" },
  "submissions/x9": { assignment_id: "b1", student_id: "s2" },
  "courses/c1/attendance/class_1": { classNumber: 1, records: { s1: "present", s2: "absent" } },
  "courses/c1/attendance/class_2": { classNumber: 2, records: { s1: "present", s2: "absent" } },
  "courses/c1/attendance/class_3": { classNumber: 3, records: { s1: "late", s2: "present" } },
};
const course = { name: "Prog II" };

describe("src/lib/csvExport", () => {
  it("roster uses the course attendance and only this course submissions", async () => {
    const db = fakeDb(DOCS);
    const { body } = await buildRosterCsv(db, "c1", course);
    const lines = body.trim().split("\n");
    assert.strictEqual(lines[1], "UNRN-1;Ana;ana@x;ana;approved;100%;1/1;REGULAR");
    // Beto: 1 de 3 presentes (33 %) y sin entrega de la tarea vencida.
    assert.strictEqual(lines[2], ";Beto;beto@x;;pending;33%;0/1;EN RIESGO");
    assert.ok(!db.reads.some((r) => r === "enrollments?[]"), "no debe escanear todas las inscripciones");
  });

  it("attendance lists every record of the course", async () => {
    const { body } = await buildAttendanceCsv(fakeDb(DOCS), "c1", course);
    const lines = body.trim().split("\n");
    assert.strictEqual(lines.length, 7);
    assert.ok(lines.some((l) => l.includes(";Prog II;3;beto@x;Beto;;;present")));
  });

  it("grades lists only this course submissions", async () => {
    const { body } = await buildGradesCsv(fakeDb(DOCS), "c1", course);
    const lines = body.trim().split("\n");
    assert.strictEqual(lines.length, 2);
    assert.ok(lines[1].includes(";x1;ana@x;TP1 - Ana;https://github.com/o/r;"));
  });

  it("escapes separators and quotes", () => {
    assert.strictEqual(escapeCsv('a;"b"'), '"a;""b"""');
  });
});
