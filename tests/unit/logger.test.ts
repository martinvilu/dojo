import { describe, it } from "node:test";
import assert from "node:assert";
import { logger } from "../../src/lib/logger.ts";

describe("src/lib/logger", () => {
  it("emits structured JSON logs on the server", () => {
    const logs: string[] = [];
    const warns: string[] = [];
    const errors: string[] = [];
    const debugs: string[] = [];

    const origLog = console.log;
    const origWarn = console.warn;
    const origErr = console.error;
    const origDebug = console.debug;
    const origNodeEnv = process.env.NODE_ENV;

    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = "development";
      console.log = (msg: string) => logs.push(msg);
      console.warn = (msg: string) => warns.push(msg);
      console.error = (msg: string) => errors.push(msg);
      console.debug = (msg: string) => debugs.push(msg);

      logger.info("Server started", { port: 3000 });
      logger.warn("Slow query", { ms: 1200 });
      logger.error("Unhandled exception", new Error("Boom"), { reqId: "r1" });
      logger.error("Object error", { code: 500 });
      logger.error("String error", "plain");
      logger.debug("Trace step", { step: 1 });

      assert.strictEqual(logs.length, 1);
      const parsedInfo = JSON.parse(logs[0]);
      assert.strictEqual(parsedInfo.severity, "INFO");
      assert.strictEqual(parsedInfo.message, "Server started");
      assert.strictEqual(parsedInfo.port, 3000);

      const parsedWarn = JSON.parse(warns[0]);
      assert.strictEqual(parsedWarn.severity, "WARNING");

      assert.strictEqual(errors.length, 3);
      assert.ok(JSON.parse(errors[0]).errorDetails.includes("Boom"));
      assert.strictEqual(JSON.parse(errors[1]).errorDetails, '{"code":500}');
      assert.strictEqual(JSON.parse(errors[2]).errorDetails, "plain");

      assert.strictEqual(debugs.length, 1);
      assert.strictEqual(JSON.parse(debugs[0]).severity, "DEBUG");

      // In production, debug is suppressed
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      logger.debug("Should not log");
      assert.strictEqual(debugs.length, 1);
    } finally {
      console.log = origLog;
      console.warn = origWarn;
      console.error = origErr;
      console.debug = origDebug;
      (process.env as Record<string, string | undefined>).NODE_ENV = origNodeEnv;
    }
  });

  it("formats console output when running in browser window context", () => {
    const origWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    const origInfo = console.info;
    const origWarn = console.warn;
    const origErr = console.error;
    const origDebug = console.debug;
    const origNodeEnv = process.env.NODE_ENV;

    const captured: string[] = [];

    try {
      Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
      (process.env as Record<string, string | undefined>).NODE_ENV = "development";
      console.info = (msg: string) => captured.push(msg);
      console.warn = (msg: string) => captured.push(msg);
      console.error = (msg: string) => captured.push(msg);
      console.debug = (msg: string) => captured.push(msg);

      logger.info("Client info");
      logger.warn("Client warn");
      logger.error("Client error");
      logger.debug("Client debug");

      assert.strictEqual(captured.length, 4);
      assert.ok(captured[0].includes("[INFO] Client info"));
      assert.ok(captured[1].includes("[WARN] Client warn"));
      assert.ok(captured[2].includes("[ERROR] Client error"));
      assert.ok(captured[3].includes("[DEBUG] Client debug"));
    } finally {
      if (origWindow) Object.defineProperty(globalThis, "window", origWindow);
      else delete (globalThis as Record<string, unknown>).window;
      console.info = origInfo;
      console.warn = origWarn;
      console.error = origErr;
      console.debug = origDebug;
      (process.env as Record<string, string | undefined>).NODE_ENV = origNodeEnv;
    }
  });
});
