import { describe, it } from "node:test";
import assert from "node:assert";
import crypto from "crypto";
import { isAllowedOrigin, getCorsHeaders, handleCorsPreflight } from "../../src/lib/cors.ts";
import { verifyGitHubWebhookSignature } from "../../src/lib/github/webhookVerification.ts";

describe("src/lib/cors", () => {
  it("allows direct requests without origin", () => {
    assert.strictEqual(isAllowedOrigin(null), true);
  });

  it("allows official UNRN moodle and hosting origins", () => {
    assert.strictEqual(isAllowedOrigin("https://moodle.unrn.edu.ar"), true);
    assert.strictEqual(isAllowedOrigin("https://dojo--jutsu-classroom-mrtin.us-east4.hosted.app"), true);
  });

  it("allows NEXT_PUBLIC_APP_URL and localhost in non-production", () => {
    const origUrl = process.env.NEXT_PUBLIC_APP_URL;
    const origNodeEnv = process.env.NODE_ENV;
    try {
      process.env.NEXT_PUBLIC_APP_URL = "https://custom.unrn.edu.ar";
      (process.env as Record<string, string | undefined>).NODE_ENV = "development";
      assert.strictEqual(isAllowedOrigin("https://custom.unrn.edu.ar"), true);
      assert.strictEqual(isAllowedOrigin("http://localhost:3000"), true);
      assert.strictEqual(isAllowedOrigin("http://127.0.0.1:8080"), true);

      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      assert.strictEqual(isAllowedOrigin("http://localhost:3000"), false);
    } finally {
      if (origUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = origUrl;
      (process.env as Record<string, string | undefined>).NODE_ENV = origNodeEnv;
    }
  });

  it("blocks untrusted malicious origins", () => {
    assert.strictEqual(isAllowedOrigin("https://attacker-site.com"), false);
    assert.strictEqual(isAllowedOrigin("https://phishing-unrn.com"), false);
  });

  it("returns cors headers containing allowed origin and omits untrusted origin", () => {
    const req = new Request("https://example.com/api/test", {
      headers: { origin: "https://moodle.unrn.edu.ar" },
    });
    const headers = getCorsHeaders(req);
    assert.strictEqual(headers["Access-Control-Allow-Origin"], "https://moodle.unrn.edu.ar");
    assert.strictEqual(headers["Access-Control-Allow-Credentials"], "true");

    const untrustedReq = new Request("https://example.com/api/test", {
      headers: { origin: "https://evil.example.com" },
    });
    const untrustedHeaders = getCorsHeaders(untrustedReq);
    assert.strictEqual(untrustedHeaders["Access-Control-Allow-Origin"], undefined);
  });

  it("handles CORS preflight OPTIONS requests and returns null for non-OPTIONS", () => {
    const optionsReq = new Request("https://example.com/api/test", {
      method: "OPTIONS",
      headers: { origin: "https://moodle.unrn.edu.ar" },
    });
    const preflightRes = handleCorsPreflight(optionsReq);
    assert.ok(preflightRes instanceof Response);
    assert.strictEqual(preflightRes?.status, 204);
    assert.strictEqual(preflightRes?.headers.get("Access-Control-Allow-Origin"), "https://moodle.unrn.edu.ar");

    const getReq = new Request("https://example.com/api/test", { method: "GET" });
    assert.strictEqual(handleCorsPreflight(getReq), null);
  });
});

describe("src/lib/github/webhookVerification", () => {
  const secret = "test-webhook-secret-12345";
  const payload = JSON.stringify({ action: "opened", repository: { name: "lab-1" } });

  it("validates authentic string and Buffer payloads signed with correct secret", () => {
    const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    const validHeader = `sha256=${hmac}`;

    assert.strictEqual(verifyGitHubWebhookSignature(payload, validHeader, secret), true);
    assert.strictEqual(verifyGitHubWebhookSignature(Buffer.from(payload), validHeader, secret), true);
  });

  it("rejects payloads with tampered body, invalid signature, or missing sha256= prefix", () => {
    const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    const validHeader = `sha256=${hmac}`;

    assert.strictEqual(verifyGitHubWebhookSignature(payload + "tampered", validHeader, secret), false);
    assert.strictEqual(verifyGitHubWebhookSignature(payload, "sha256=invalidhash", secret), false);
    assert.strictEqual(verifyGitHubWebhookSignature(payload, `sha1=${hmac}`, secret), false);
    assert.strictEqual(verifyGitHubWebhookSignature(payload, `sha256=${"0".repeat(64)}`, secret), false);
  });

  it("rejects missing header, empty secret, or internal verification exception", () => {
    assert.strictEqual(verifyGitHubWebhookSignature(payload, null, secret), false);
    assert.strictEqual(verifyGitHubWebhookSignature(payload, "sha256=123", ""), false);
    assert.strictEqual(
      verifyGitHubWebhookSignature(12345 as unknown as string, "sha256=" + "a".repeat(64), secret),
      false
    );
  });
});

