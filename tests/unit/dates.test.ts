import { describe, it } from "node:test";
import assert from "node:assert";
import { toDateSafe, formatDateSafe, formatDateTime, formatShortDate } from "../../src/lib/dates.ts";

describe("src/lib/dates", () => {
  it("handles null, undefined and empty strings safely", () => {
    assert.strictEqual(toDateSafe(null), null);
    assert.strictEqual(toDateSafe(undefined), null);
    assert.strictEqual(toDateSafe(""), null);
    assert.strictEqual(formatDateSafe(null), "—");
    assert.strictEqual(formatDateSafe(undefined), "—");
    assert.strictEqual(formatDateSafe(""), "—");
  });

  it("parses valid Date instances", () => {
    const d = new Date("2026-03-15T14:30:00.000Z");
    const parsed = toDateSafe(d);
    assert.ok(parsed instanceof Date);
    assert.strictEqual(parsed?.getTime(), d.getTime());
  });

  it("returns null on invalid dates", () => {
    assert.strictEqual(toDateSafe("not-a-date"), null);
    assert.strictEqual(formatDateSafe("not-a-date"), "—");
  });

  it("handles Firestore timestamp objects with seconds", () => {
    const fakeTimestamp = { seconds: 1773585000, nanoseconds: 0 };
    const parsed = toDateSafe(fakeTimestamp);
    assert.ok(parsed instanceof Date);
    assert.strictEqual(parsed?.getTime(), 1773585000 * 1000);
  });

  it("formats with custom formatters", () => {
    const d = new Date("2026-05-25T12:00:00Z");
    const formatted = formatDateSafe(d, formatShortDate);
    assert.ok(formatted.includes("2026"));
  });
});
