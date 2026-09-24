import { describe, it } from "node:test";
import assert from "node:assert";
import { runHealthChecks, healthHttpStatus } from "../../src/lib/health.ts";

const never = () => new Promise(() => {});

describe("src/lib/health", () => {
  it("reports ok when every probe passes", async () => {
    const report = await runHealthChecks([{ name: "firestore", run: async () => true }]);
    assert.strictEqual(report.status, "ok");
    assert.strictEqual(report.checks.firestore.status, "ok");
    assert.strictEqual(healthHttpStatus(report), 200);
  });

  it("is down (503) when a required probe fails, without leaking the message", async () => {
    const report = await runHealthChecks([
      { name: "firestore", run: async () => { throw new TypeError("secret connection string"); } },
    ]);
    assert.strictEqual(report.status, "down");
    assert.strictEqual(report.checks.firestore.error, "TypeError");
    assert.ok(!JSON.stringify(report).includes("secret"));
    assert.strictEqual(healthHttpStatus(report), 503);
  });

  it("is degraded (200) when only optional probes fail", async () => {
    const report = await runHealthChecks([
      { name: "firestore", run: async () => true },
      { name: "github_api", required: false, run: async () => { throw new Error("rate limited"); } },
    ]);
    assert.strictEqual(report.status, "degraded");
    assert.strictEqual(healthHttpStatus(report), 200);
  });

  it("times out slow probes", async () => {
    const report = await runHealthChecks([{ name: "firestore", run: never, timeoutMs: 20 }]);
    assert.strictEqual(report.checks.firestore.status, "timeout");
    assert.strictEqual(report.status, "down");
  });
});
