import { describe, it } from "node:test";
import assert from "node:assert";
import {
  toDateSafe,
  formatDateSafe,
  formatDateTime,
  formatShortDate,
  formatDateFull,
  formatTimeOnly,
} from "../../src/lib/dates.ts";

describe("src/lib/dates", () => {
  it("handles null, undefined and empty strings safely", () => {
    assert.strictEqual(toDateSafe(null), null);
    assert.strictEqual(toDateSafe(undefined), null);
    assert.strictEqual(toDateSafe(""), null);
    assert.strictEqual(formatDateSafe(null), "—");
    assert.strictEqual(formatDateSafe(undefined), "—");
    assert.strictEqual(formatDateSafe(""), "—");
  });

  it("parses valid Date instances and rejects invalid Date instances", () => {
    const d = new Date("2026-03-15T14:30:00.000Z");
    const parsed = toDateSafe(d);
    assert.ok(parsed instanceof Date);
    assert.strictEqual(parsed?.getTime(), d.getTime());
    assert.strictEqual(toDateSafe(new Date("invalid")), null);
  });

  it("returns null on invalid dates and unsupported types", () => {
    assert.strictEqual(toDateSafe("not-a-date"), null);
    assert.strictEqual(formatDateSafe("not-a-date"), "—");
    assert.strictEqual(toDateSafe(true), null);
    assert.strictEqual(toDateSafe({}), null);
  });

  it("handles Firestore timestamp objects with seconds or toDate()", () => {
    const fakeTimestamp = { seconds: 1773585000, nanoseconds: 0 };
    const parsed = toDateSafe(fakeTimestamp);
    assert.ok(parsed instanceof Date);
    assert.strictEqual(parsed?.getTime(), 1773585000 * 1000);

    const sdkTimestamp = { toDate: () => new Date("2026-04-01T10:00:00Z") };
    const parsedSdk = toDateSafe(sdkTimestamp);
    assert.ok(parsedSdk instanceof Date);
    assert.strictEqual(parsedSdk?.toISOString(), "2026-04-01T10:00:00.000Z");

    const invalidSdkTimestamp = { toDate: () => new Date("bad") };
    assert.strictEqual(toDateSafe(invalidSdkTimestamp), null);
  });

  it("parses epoch numbers", () => {
    const epoch = 1773585000000;
    const parsed = toDateSafe(epoch);
    assert.strictEqual(parsed?.getTime(), epoch);
  });

  it("formats with default and custom formatters", () => {
    const d = new Date("2026-05-25T12:00:00Z");
    assert.ok(formatDateSafe(d).includes("2026"));
    assert.ok(formatDateSafe(d, formatDateTime).includes("2026"));
    assert.ok(formatDateSafe(d, formatShortDate).includes("2026"));
    assert.ok(formatDateSafe(d, formatDateFull).includes("2026"));
    assert.ok(formatDateSafe(d, formatTimeOnly).includes(":"));
  });
});

