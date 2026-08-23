const { detectAssignmentPlagiarism } = require("../src/modules/github/plagiarism");

// Two near-identical "repos" and one unrelated, served via mocked raw fetch
const CODE_A = `
function calcularPromedioDeLasNotasDelAlumno(notas) {
  let totalAcumulado = 0;
  for (let i = 0; i < notas.length; i++) { totalAcumulado += notas[i]; }
  return totalAcumulado / notas.length;
}
`;
const CODE_A_COPY = `
function calcular_promedio_de_las_notas_del_alumno(notas) {
  let total_acumulado = 0
  for (let i = 0; i < notas.length; i++) { total_acumulado += notas[i] }
  return total_acumulado / notas.length
}
`;
const CODE_OTHER = `
class ArbolBinarioDeBusqueda {
  insertar(valor) { this.raiz = this._insertar(this.raiz, valor); }
}
`;

const REPOS = {
  "alumno1/tp": [{ path: "src/main.js", content: CODE_A }],
  "alumno2/tp": [{ path: "main.js", content: CODE_A_COPY }],
  "alumno3/tp": [{ path: "main.js", content: CODE_OTHER }],
};

global.fetch = jest.fn(async (url) => {
  if (/\/repos\/[^/]+\/[^/]+$/.test(url)) {
    return { ok: true, json: async () => ({ default_branch: "main" }) };
  }
  if (url.includes("/git/trees/")) {
    return { ok: true, json: async () => ({ tree: REPOS[Object.keys(REPOS).find(k => url.includes(k))].map(f => ({ type: "blob", path: f.path, size: f.content.length })) }) };
  }
  if (url.includes("raw.githubusercontent.com")) {
    const key = Object.keys(REPOS).find((k) => url.includes(k));
    const file = REPOS[key][0];
    return { ok: true, text: async () => file.content };
  }
  return { ok: false, status: 404 };
});

jest.mock('node-fetch', () => global.fetch);

describe("detectAssignmentPlagiarism", () => {
  const buildContext = () => {
    const docs = {
      assignments: { a1: { data: () => ({ course_id: "c1", title: "TP Funciones" }) } },
      courses: { c1: { data: () => ({ github_token: "tok" }) } },
      course_teachers: { c1_teacher1: { data: () => ({ teacher_id: "teacher1" }) } },
    };
    const submissions = [
      { id: "s1", data: () => ({ assignment_id: "a1", student_id: "u1", repo_url: "https://github.com/alumno1/tp", profiles: { full_name: "Uno" } }) },
      { id: "s2", data: () => ({ assignment_id: "a1", student_id: "u2", repo_url: "https://github.com/alumno2/tp", profiles: { full_name: "Dos" } }) },
      { id: "s3", data: () => ({ assignment_id: "a1", student_id: "u3", repo_url: "https://github.com/alumno3/tp", profiles: { full_name: "Tres" } }) },
      { id: "s4", data: () => ({ assignment_id: "a1", student_id: "u4" }) },
    ];
    return {
      uid: "teacher1",
      getMyProfile: jest.fn().mockResolvedValue({ role: "teacher" }),
      db: {
        collection: jest.fn().mockImplementation((name) => ({
          doc: jest.fn().mockImplementation((id) => ({
            get: jest.fn().mockResolvedValue({ exists: !!docs[name]?.[id], data: docs[name]?.[id]?.data }),
          })),
          where: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue({ docs: submissions.map((sd) => ({ id: sd.id, data: sd.data })) }),
          }),
        })),
      },
    };
  };

  it("flags the copied pair above threshold and ignores the rest", async () => {
    const ctx = buildContext();
    const res = await detectAssignmentPlagiarism({ assignmentId: "a1", threshold: 50 }, ctx);

    expect(res.analyzedCount).toBe(3);
    expect(res.skipped).toEqual([{ student: "u4", reason: "Entrega sin repositorio" }]);
    expect(res.pairs).toHaveLength(3); // C(3,2)

    const top = res.pairs[0];
    expect(top.a.name).toMatch(/Uno|Dos/);
    expect(top.b.name).toMatch(/Uno|Dos/);
    expect(top.score).toBeGreaterThanOrEqual(50);
    expect(res.flaggedCount).toBe(1);
  });

  it("rejects non-teacher users", async () => {
    const ctx = buildContext();
    ctx.uid = "intruder1"; // no course_teachers doc for this uid
    ctx.getMyProfile = jest.fn().mockResolvedValue({ role: "student" });
    await expect(
      detectAssignmentPlagiarism({ assignmentId: "a1" }, ctx)
    ).rejects.toThrow("Solo el docente");
  });

  it("requires assignment id", async () => {
    const ctx = buildContext();
    await expect(detectAssignmentPlagiarism({}, ctx)).rejects.toThrow("Falta el ID");
  });
});
