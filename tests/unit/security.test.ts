import { describe, it } from "node:test";
import assert from "node:assert";
import crypto from "crypto";
import { isAllowedOrigin, getCorsHeaders } from "../../src/lib/cors.ts";
import { verifyGitHubWebhookSignature } from "../../src/lib/github/webhookVerification.ts";

describe("src/lib/cors", () => {
  it("allows direct requests without origin", () => {
    assert.strictEqual(isAllowedOrigin(null), true);
  });

  it("allows official UNRN moodle and hosting origins", () => {
    assert.strictEqual(isAllowedOrigin("https://moodle.unrn.edu.ar"), true);
    assert.strictEqual(isAllowedOrigin("https://dojo--jutsu-classroom-mrtin.us-east4.hosted.app"), true);
  });

  it("blocks untrusted malicious origins", () => {
    assert.strictEqual(isAllowedOrigin("https://attacker-site.com"), false);
    assert.strictEqual(isAllowedOrigin("https://phishing-unrn.com"), false);
  });

  it("returns cors headers containing allowed origin", () => {
    const req = new Request("https://example.com/api/test", {
      headers: { origin: "https://moodle.unrn.edu.ar" },
    });
    const headers = getCorsHeaders(req);
    assert.strictEqual(headers["Access-Control-Allow-Origin"], "https://moodle.unrn.edu.ar");
  });
});

describe("src/lib/github/webhookVerification", () => {
  const secret = "test-webhook-secret-12345";
  const payload = JSON.stringify({ action: "opened", repository: { name: "lab-1" } });

  it("validates authentic payloads signed with correct secret", () => {
    const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    const validHeader = `sha256=${hmac}`;

    assert.strictEqual(verifyGitHubWebhookSignature(payload, validHeader, secret), true);
  });

  it("rejects payloads with tampered body or invalid signature", () => {
    const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    const validHeader = `sha256=${hmac}`;

    assert.strictEqual(verifyGitHubWebhookSignature(payload + "tampered", validHeader, secret), false);
    assert.strictEqual(verifyGitHubWebhookSignature(payload, "sha256=invalidhash", secret), false);
  });

  it("rejects missing header or empty secret", () => {
    assert.strictEqual(verifyGitHubWebhookSignature(payload, null, secret), false);
    assert.strictEqual(verifyGitHubWebhookSignature(payload, "sha256=123", ""), false);
  });
});
