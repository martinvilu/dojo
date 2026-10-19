import { describe, it } from "node:test";
import assert from "node:assert";
import { editDistance, fuzzyScore, normalizeText } from "../../src/lib/fuzzy.ts";

describe("src/lib/fuzzy", () => {
  it("normalizes accents and case", () => {
    assert.strictEqual(normalizeText("Programación  II"), "programación  ii".normalize("NFD").replace(/[̀-ͯ]/g, ""));
  });

  it("computes bounded Damerau-Levenshtein distances", () => {
    assert.strictEqual(editDistance("practica", "practica"), 0);
    assert.strictEqual(editDistance("pratcica", "practica"), 1); // transposición
    assert.strictEqual(editDistance("asistencia", "asistensia"), 1);
    assert.strictEqual(editDistance("git", "gestion", 1), 2);
  });

  it("ranks exact phrases over scattered words and tolerates typos", () => {
    const exact = fuzzyScore("trabajo practico", "Trabajo Práctico 2: Git")!;
    const words = fuzzyScore("practico trabajo", "Trabajo Práctico 2: Git")!;
    const typo = fuzzyScore("trabjo practco", "Trabajo Práctico 2: Git")!;
    assert.ok(exact > words && words > typo && typo > 0);
    assert.strictEqual(fuzzyScore("algoritmos", "Trabajo Práctico 2: Git"), null);
    assert.strictEqual(fuzzyScore("gi", "Introducción a Python"), null); // sin tolerancia en palabras cortas
  });

  it("matches word prefixes", () => {
    assert.ok(fuzzyScore("progra", "Programación II")! > 0);
  });
});
