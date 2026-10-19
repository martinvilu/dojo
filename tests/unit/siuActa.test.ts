import { describe, it } from "node:test";
import assert from "node:assert";
import { createHmac } from "node:crypto";
import { buildRegularityActa, signActa } from "../../src/lib/siuActa.ts";

function fakeDb(docs: Record<string, any>) {
  const matches = (d: any, [f, op, v]: any[]) => (op === "in" ? v.includes(d[f]) : d[f] === v);
  const coll = (prefix: string, filters: any[] = []): any => ({
    where: (f: string, op: string, v: any) => coll(prefix, [...filters, [f, op, v]]),
    doc: (id: string) => ({ path: `${prefix}/${id}`, collection: (n: string) => coll(`${prefix}/${id}/${n}`) }),
    get: async () => ({
      docs: Object.keys(docs)
        .filter((k) => k.startsWith(`${prefix}/`) && k.split("/").length === prefix.split("/").length + 1 && filters.every((fl) => matches(docs[k], fl)))
        .map((k) => ({ id: k.split("/").pop(), data: () => docs[k] })),
    }),
  });
  return { collection: (n: string) => coll(n), getAll: async (...refs: any[]) => refs.map((r) => ({ exists: r.path in docs, data: () => docs[r.path] })) };
}

const DOCS = {
  "course_roster/c1_s1": { course_id: "c1", student_id: "s1" },
  "course_roster/c1_s2": { course_id: "c1", student_id: "s2" },
  "profiles/s1": { full_name: "Ana", matricula_unrn: "UNRN-1" },
  "profiles/s2": { full_name: "Beto", matricula_unrn: "UNRN-2" },
  "assignments/a1": { course_id: "c1" },
  "assignments/a2": { course_id: "c1" },
  "submissions/x1": { assignment_id: "a1", student_id: "s1", grade: "8" },
  "submissions/x2": { assignment_id: "a2", student_id: "s1", grade: "Aprobado" },
  "submissions/x3": { assignment_id: "a1", student_id: "s2", grade: "3,5" },
  "courses/c1/attendance/class_1": { records: { s1: "present", s2: "present" } },
  "courses/c1/attendance/class_2": { records: { s1: "late", s2: "absent" } },
};

describe("src/lib/siuActa", () => {
  it("computes REGULAR / LIBRE per student", async () => {
    const acta = await buildRegularityActa(fakeDb(DOCS), "c1", { name: "Prog II" }, { minAttendance: 75, minGrade: 4 });
    assert.deepStrictEqual(acta.criterios, { asistencia_minima_pct: 75, nota_minima: 4 });
    const [ana, beto] = acta.estudiantes;
    assert.deepStrictEqual(
      { legajo: ana.legajo, asistencia: ana.asistencia_pct, aprobadas: ana.tareas_aprobadas, promedio: ana.promedio, condicion: ana.condicion },
      { legajo: "UNRN-1", asistencia: 100, aprobadas: 2, promedio: 8, condicion: "REGULAR" }
    );
    assert.strictEqual(beto.asistencia_pct, 50);
    assert.strictEqual(beto.condicion, "LIBRE");
    assert.strictEqual(beto.promedio, 3.5);
  });

  it("signs the body with HMAC-SHA256", () => {
    const body = '{"a":1}';
    assert.strictEqual(signActa(body, "S"), "sha256=" + createHmac("sha256", "S").update(body).digest("hex"));
  });
});
