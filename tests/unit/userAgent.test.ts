import { describe, it } from "node:test";
import assert from "node:assert";
import { describeProvider, describeUserAgent } from "../../src/lib/userAgent.ts";

describe("src/lib/userAgent", () => {
  it("describes common browsers and systems", () => {
    assert.strictEqual(describeUserAgent("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36"), "Chrome en Android");
    assert.strictEqual(describeUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1"), "Safari en iOS");
    assert.strictEqual(describeUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36 Edg/126.0"), "Edge en Windows");
    assert.strictEqual(describeUserAgent("Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0"), "Firefox en Linux");
    assert.strictEqual(describeUserAgent(null), "Dispositivo desconocido");
  });

  it("names sign-in providers", () => {
    assert.strictEqual(describeProvider("google.com"), "Google");
    assert.strictEqual(describeProvider("saml.unrn"), "saml.unrn");
  });
});
