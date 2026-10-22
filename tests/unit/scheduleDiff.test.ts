import { describe, it } from "node:test";
import assert from "node:assert";
import { diffSchedules } from "../../src/modules/course/components/schedule/scheduleDiff.ts";

const c = (topic: string, type = "Teórica", special_status = "Normal") => ({ topic, type, special_status });

describe("scheduleDiff", () => {
  it("classifies identical, modified, added and removed classes", () => {
    const diff = diffSchedules([c("Git"), c("Arrays", "Práctica"), c("Extra")], [c("Git"), c("Arrays")]);
    assert.deepStrictEqual(diff.map((d) => d.status), ["identical", "modified", "added"]);
    assert.deepStrictEqual(diffSchedules([c("Git")], [c("Git"), c("Repaso")]).map((d) => d.status), ["identical", "removed"]);
  });

  it("detects classes moved to another position", () => {
    const diff = diffSchedules([c("Recursión"), c("Git")], [c("Git"), c("Recursión")]);
    assert.deepStrictEqual(diff.map((d) => [d.status, d.movedFrom]), [["moved", 2], ["moved", 1]]);
  });

  it("does not treat empty topics as moves", () => {
    assert.strictEqual(diffSchedules([c(""), c("A")], [c("A"), c("", "Práctica")])[1].status, "moved");
    assert.strictEqual(diffSchedules([c("", "Práctica")], [c("")])[0].status, "modified");
  });
});
