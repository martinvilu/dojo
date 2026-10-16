import { describe, it } from "node:test";
import assert from "node:assert";
import { getBaseUrl } from "../../src/lib/url.ts";

describe("src/lib/url", () => {
  it("uses NEXT_PUBLIC_APP_URL when set to a public URL and strips trailing slash", () => {
    const origUrl = process.env.NEXT_PUBLIC_APP_URL;
    try {
      process.env.NEXT_PUBLIC_APP_URL = "https://dojo.unrn.edu.ar/";
      assert.strictEqual(getBaseUrl(), "https://dojo.unrn.edu.ar");
    } finally {
      if (origUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = origUrl;
    }
  });

  it("ignores NEXT_PUBLIC_APP_URL if it points to an internal address", () => {
    const origUrl = process.env.NEXT_PUBLIC_APP_URL;
    const origNodeEnv = process.env.NODE_ENV;
    try {
      process.env.NEXT_PUBLIC_APP_URL = "http://0.0.0.0:8080/";
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      assert.strictEqual(getBaseUrl(), "https://dojo--jutsu-classroom-mrtin.us-east4.hosted.app");
    } finally {
      if (origUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = origUrl;
      (process.env as Record<string, string | undefined>).NODE_ENV = origNodeEnv;
    }
  });

  it("extracts public domain from x-forwarded-host or host header", () => {
    const origUrl = process.env.NEXT_PUBLIC_APP_URL;
    try {
      delete process.env.NEXT_PUBLIC_APP_URL;
      const req = new Request("http://0.0.0.0:8080/api/lti", {
        headers: {
          "x-forwarded-host": "campus.unrn.edu.ar",
          "x-forwarded-proto": "https",
        },
      });
      assert.strictEqual(getBaseUrl(req), "https://campus.unrn.edu.ar");

      const hostReq = new Request("http://0.0.0.0:8080/api/lti", {
        headers: { host: "aula.unrn.edu.ar" },
      });
      assert.strictEqual(getBaseUrl(hostReq), "https://aula.unrn.edu.ar");
    } finally {
      if (origUrl !== undefined) process.env.NEXT_PUBLIC_APP_URL = origUrl;
    }
  });

  it("returns localhost in strict local development mode and remaps port 8080 to 3000", () => {
    const origUrl = process.env.NEXT_PUBLIC_APP_URL;
    const origNodeEnv = process.env.NODE_ENV;
    const origKService = process.env.K_SERVICE;
    const origFbConfig = process.env.FIREBASE_CONFIG;
    try {
      delete process.env.NEXT_PUBLIC_APP_URL;
      delete process.env.K_SERVICE;
      delete process.env.FIREBASE_CONFIG;
      (process.env as Record<string, string | undefined>).NODE_ENV = "development";

      assert.strictEqual(getBaseUrl(), "http://localhost:3000");

      const customPortReq = new Request("http://localhost:4000/api", {
        headers: { host: "localhost:4000" },
      });
      assert.strictEqual(getBaseUrl(customPortReq), "http://localhost:4000");

      const containerPortReq = new Request("http://0.0.0.0:8080/api", {
        headers: { host: "0.0.0.0:8080" },
      });
      assert.strictEqual(getBaseUrl(containerPortReq), "http://localhost:3000");
    } finally {
      if (origUrl !== undefined) process.env.NEXT_PUBLIC_APP_URL = origUrl;
      if (origKService !== undefined) process.env.K_SERVICE = origKService;
      if (origFbConfig !== undefined) process.env.FIREBASE_CONFIG = origFbConfig;
      (process.env as Record<string, string | undefined>).NODE_ENV = origNodeEnv;
    }
  });
});
