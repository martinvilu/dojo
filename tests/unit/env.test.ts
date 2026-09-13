import { describe, it } from "node:test";
import assert from "node:assert";
import { validateEnv, clientEnvSchema, serverEnvSchema } from "../../src/lib/env.ts";

describe("src/lib/env", () => {
  it("validates valid client environment", () => {
    const res = clientEnvSchema.safeParse({
      NEXT_PUBLIC_APP_URL: "https://dojo.unrn.edu.ar",
      NEXT_PUBLIC_FIREBASE_API_KEY: "sample-api-key",
    });
    assert.strictEqual(res.success, true);
  });

  it("fails when client app url is malformed", () => {
    const res = clientEnvSchema.safeParse({
      NEXT_PUBLIC_APP_URL: "not-a-valid-url",
    });
    assert.strictEqual(res.success, false);
  });

  it("validates server environment with defaults", () => {
    const res = serverEnvSchema.safeParse({});
    assert.strictEqual(res.success, true);
    if (res.success) {
      assert.strictEqual(res.data.NODE_ENV, "development");
    }
  });

  it("runs validateEnv helper without crashing", () => {
    const res = validateEnv();
    assert.ok(typeof res.isValid === "boolean");
  });
});
