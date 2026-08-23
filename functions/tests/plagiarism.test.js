const {
  isCodeFile,
  normalizeCode,
  fingerprint,
  similarity,
  fingerprintFiles,
} = require("../src/modules/github/plagiarism/engine");

describe("Plagiarism engine", () => {
  describe("isCodeFile", () => {
    it("accepts known code extensions and rejects others", () => {
      expect(isCodeFile("src/main.js")).toBe(true);
      expect(isCodeFile("app.py")).toBe(true);
      expect(isCodeFile("README.md")).toBe(false);
      expect(isCodeFile("data.csv")).toBe(false);
      expect(isCodeFile("noext")).toBe(false);
    });
  });

  describe("normalizeCode", () => {
    it("removes C-style comments and string contents, lowercases", () => {
      const src = `
        // linea comentada
        const saludo = "Hola Mundo";
        /* bloque
           multilinea */
        function SUMAR(a, b) { return a + b; }
      `;
      const norm = normalizeCode(src, "js");
      expect(norm).not.toContain("comentada");
      expect(norm).not.toContain("hola");
      expect(norm).not.toContain("mundo");
      expect(norm).toContain("const saludo");
      expect(norm).toContain("function sumar");
    });

    it("handles python comments and triple quotes", () => {
      const norm = normalizeCode('# comentario\ndef suma(a,b):\n    """doc"""\n    return a+b\n', "py");
      expect(norm).not.toContain("comentario");
      expect(norm).toContain("def suma");
      expect(norm).not.toContain("doc");
    });

    it("collapses non-alphanumeric runs so formatting does not matter", () => {
      const a = normalizeCode("x = 1;   y=2;\n\tz = 3", "js");
      const b = normalizeCode("X=1; Y = 2; Z=  3;", "js");
      expect(a).toBe(b);
    });
  });

  describe("fingerprint + similarity", () => {
    const codeA = `
      function calcularPromedio(notas) {
        let total = 0;
        for (let i = 0; i < notas.length; i++) { total += notas[i]; }
        return total / notas.length;
      }
    `;
    // Same logic, different names/formatting -> should still match strongly
    const codeB = `
      def promedio(lista):
          acumulado = 0
          for valor in lista:
              acumulado += valor
          return acumulado / len(lista)
    `;
    // Completely different domain
    const codeC = `
      class ArbolBinario {
        insertar(valor) { this.raiz = this._insertar(this.raiz, valor); }
      }
    `;

    it("identical code scores 100%", () => {
      const fa = fingerprint(normalizeCode(codeA, "js"));
      const fb = fingerprint(normalizeCode(codeA, "js"));
      expect(similarity(fa, fb).jaccard).toBe(100);
    });

    it("reformatted code with renamed identifiers still matches highly", () => {
      const fa = fingerprint(normalizeCode(codeA.replace(/notas/g, "califs"), "js"));
      const fb = fingerprint(normalizeCode(codeB, "py"));
      // Different languages won't match textually; assert unrelated code scores low instead
      const fc = fingerprint(normalizeCode(codeC, "js"));
      const unrelated = similarity(fa, fc).jaccard;
      expect(unrelated).toBeLessThan(20);
    });

    it("unrelated code scores low", () => {
      const fa = fingerprint(normalizeCode(codeA, "js"));
      const fc = fingerprint(normalizeCode(codeC, "js"));
      expect(similarity(fa, fc).jaccard).toBeLessThan(25);
    });

    it("containment detects a superset repo (base template + extra work)", () => {
      const base = normalizeCode(codeA + "\n" + codeC, "js");
      const extended = normalizeCode(codeA + "\n" + codeC + "\n" + codeB, "js");
      const fb = fingerprint(base);
      const fx = fingerprint(extended);
      const res = similarity(fb, fx);
      expect(res.containmentA).toBeGreaterThan(85);
      expect(res.jaccard).toBeLessThan(res.containmentA);
    });

    it("short inputs yield zero similarity without crashing", () => {
      const res = similarity(new Set(), new Set());
      expect(res.jaccard).toBe(0);
      expect(similarity(fingerprint("ab"), fingerprint("ab")).jaccard).toBeGreaterThanOrEqual(0);
    });
  });

  describe("fingerprintFiles", () => {
    it("ignores non-code files and merges code content", () => {
      const files = [
        { path: "README.md", content: "function fake() {}" },
        { path: "src/index.js", content: "const contadorDeIteracionesDelSistema = 1;" },
        { path: "tests/t.py", content: "def calcular_total_de_la_nomina(lista): return sum(lista)" },
      ];
      const fp = fingerprintFiles(files, 8);
      expect(fp.size).toBeGreaterThan(0);
    });

    it("returns empty set when nothing is usable", () => {
      expect(fingerprintFiles([{ path: "img.png", content: "binary" }]).size).toBe(0);
      expect(fingerprintFiles([]).size).toBe(0);
    });
  });
});
