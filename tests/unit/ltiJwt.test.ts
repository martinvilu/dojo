import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { generateKeyPairSync } from "node:crypto";
import { clearJwksCache, decodeJwt, publicJwkFromPrivate, signToolJwt, verifyPlatformJwt } from "../../src/lib/lti/jwt.ts";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const { privateKey: otherKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwks = { keys: [publicJwkFromPrivate(privateKey, "moodle-1")] };
const fetcher = async () => jwks;
const NOW = 1_800_000_000_000;
const base = { iss: "https://moodle.unrn.edu.ar", aud: "client-123", iat: NOW / 1000, exp: NOW / 1000 + 300, nonce: "n1" };
const opts = { jwksUrl: "https://moodle.unrn.edu.ar/mod/lti/certs.php", issuer: base.iss, audience: "client-123", now: NOW, fetcher };

describe("src/lib/lti/jwt", () => {
  beforeEach(() => clearJwksCache());

  it("verifies a platform token signed with a published key", async () => {
    const token = signToolJwt(base, privateKey, "moodle-1");
    const payload = await verifyPlatformJwt(token, opts);
    assert.strictEqual(payload.nonce, "n1");
  });

  it("rejects bad signatures, issuers, audiences, expiry and algorithms", async () => {
    await assert.rejects(verifyPlatformJwt(signToolJwt(base, otherKey, "moodle-1"), opts), /Firma/);
    await assert.rejects(verifyPlatformJwt(signToolJwt({ ...base, iss: "https://evil" }, privateKey, "moodle-1"), opts), /Emisor/);
    await assert.rejects(verifyPlatformJwt(signToolJwt({ ...base, aud: "otro" }, privateKey, "moodle-1"), opts), /Audiencia/);
    await assert.rejects(verifyPlatformJwt(signToolJwt({ ...base, exp: NOW / 1000 - 120 }, privateKey, "moodle-1"), opts), /vencido/);
    await assert.rejects(verifyPlatformJwt(signToolJwt(base, privateKey, "desconocida"), opts), /clave/);
    const parts = signToolJwt(base, privateKey, "moodle-1").split(".");
    const noneHeader = Buffer.from(JSON.stringify({ alg: "none", kid: "moodle-1" })).toString("base64url");
    await assert.rejects(verifyPlatformJwt(`${noneHeader}.${parts[1]}.`, opts), /Algoritmo/);
    await assert.rejects(verifyPlatformJwt("no.es.jwt", opts), /mal formado/);
  });

  it("accepts multiple audiences only with a matching azp", async () => {
    await verifyPlatformJwt(signToolJwt({ ...base, aud: ["client-123", "x"], azp: "client-123" }, privateKey, "moodle-1"), opts);
    await assert.rejects(verifyPlatformJwt(signToolJwt({ ...base, aud: ["client-123", "x"], azp: "x" }, privateKey, "moodle-1"), opts), /azp/);
  });

  it("publishes the public key and signs tool messages", () => {
    const jwk = publicJwkFromPrivate(privateKey, "dojo-1") as any;
    assert.strictEqual(jwk.kid, "dojo-1");
    assert.strictEqual(jwk.d, undefined); // nunca la parte privada
    const decoded = decodeJwt(signToolJwt({ a: 1 }, privateKey, "dojo-1"));
    assert.deepStrictEqual(decoded.header, { alg: "RS256", typ: "JWT", kid: "dojo-1" });
  });
});
