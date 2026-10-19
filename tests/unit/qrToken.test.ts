import { describe, it } from "node:test";
import assert from "node:assert";
import { qrCodeForStep, qrStepAt, secondsUntilRotation } from "../../src/lib/qrToken.ts";

// Mismo vector que functions/tests/qrToken.test.js.
const SECRET = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";

describe("src/lib/qrToken", () => {
  it("derives the same code as the backend", async () => {
    assert.strictEqual(await qrCodeForStep(SECRET, 123456), "R44U94");
  });

  it("computes steps and time to rotation", () => {
    assert.strictEqual(qrStepAt(30_000, 15), 2);
    assert.strictEqual(qrStepAt(44_999, 15), 2);
    assert.strictEqual(secondsUntilRotation(30_000, 15), 15);
    assert.strictEqual(secondsUntilRotation(44_100, 15), 1);
  });
});
