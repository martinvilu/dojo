import { describe, it } from "node:test";
import assert from "node:assert";
import { parseCsv, parseMoodleLogCsv, parseMoodleTime } from "../../src/modules/moodle/utils/moodleLogCsv.ts";

const SPANISH = `﻿Hora,Nombre completo del usuario,Usuario afectado,Contexto del evento,Componente,Nombre evento,Descripción,Origen,Dirección IP
"10/06/26, 10:00",Ana Pérez,-,"Curso: Programación I",Sistema,Curso visto,"The user with id '19284' viewed the course with id '55'.",web,10.0.0.1
"10/06/26, 10:05",Ana Pérez,-,"Archivo: TP1, enunciado",Archivo,Módulo de curso visto,"The user with id '19284' viewed the 'resource' activity with course module id '7'.",web,10.0.0.1
"10/06/26, 10:06",-,-,Sistema,Sistema,Tarea programada,"Scheduled task ran.",cli,
`;

describe("Moodle log CSV", () => {
  it("parses quoted fields with commas and escaped quotes", () => {
    assert.deepStrictEqual(parseCsv('a,"b, c","d ""e"""\n1,2,3'), [["a", "b, c", 'd "e"'], ["1", "2", "3"]]);
    assert.deepStrictEqual(parseCsv("a;b\n1;2"), [["a", "b"], ["1", "2"]]);
  });

  it("extracts user ids and skips rows without one", () => {
    const { events, rows, skipped } = parseMoodleLogCsv(SPANISH);
    assert.strictEqual(rows, 3);
    assert.strictEqual(skipped, 1);
    assert.deepStrictEqual(events.map((e) => e.userId), ["19284", "19284"]);
    assert.strictEqual(events[1].context, "Archivo: TP1, enunciado");
    assert.strictEqual(events[0].eventName, "Curso visto");
  });

  it("reads Moodle dates as Argentina time", () => {
    assert.strictEqual(new Date(parseMoodleTime("10/06/26, 10:00")!).toISOString(), "2026-06-10T13:00:00.000Z");
    assert.strictEqual(new Date(parseMoodleTime("1/6/2026 09:05:30")!).toISOString(), "2026-06-01T12:05:30.000Z");
    assert.strictEqual(parseMoodleTime("ayer"), null);
  });

  it("rejects files that are not Moodle logs", () => {
    assert.throws(() => parseMoodleLogCsv("nombre,nota\nAna,7"), /no parece un log de Moodle/);
  });
});
