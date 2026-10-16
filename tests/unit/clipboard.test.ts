import { describe, it } from "node:test";
import assert from "node:assert";
import { copyToClipboard } from "../../src/lib/clipboard.ts";

describe("src/lib/clipboard", () => {
  it("returns false for empty text", async () => {
    assert.strictEqual(await copyToClipboard(""), false);
  });

  it("uses navigator.clipboard.writeText when available", async () => {
    const origDesc = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    let copied = "";
    try {
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: {
          clipboard: {
            writeText: async (t: string) => {
              copied = t;
            },
          },
        },
      });
      const res = await copyToClipboard("INVITE-CODE-123");
      assert.strictEqual(res, true);
      assert.strictEqual(copied, "INVITE-CODE-123");
    } finally {
      if (origDesc) Object.defineProperty(globalThis, "navigator", origDesc);
      else delete (globalThis as Record<string, unknown>).navigator;
    }
  });

  it("falls back to document.execCommand('copy') when navigator.clipboard fails", async () => {
    const origNav = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    const origDoc = Object.getOwnPropertyDescriptor(globalThis, "document");
    let appended = false;
    let removed = false;
    try {
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: {
          clipboard: {
            writeText: async () => {
              throw new Error("Permission denied");
            },
          },
        },
      });
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: {
          createElement: () => ({
            value: "",
            style: {},
            focus: () => {},
            select: () => {},
          }),
          body: {
            appendChild: () => {
              appended = true;
            },
            removeChild: () => {
              removed = true;
            },
          },
          execCommand: (cmd: string) => cmd === "copy",
        },
      });

      const res = await copyToClipboard("FALLBACK-TEXT");
      assert.strictEqual(res, true);
      assert.strictEqual(appended, true);
      assert.strictEqual(removed, true);
    } finally {
      if (origNav) Object.defineProperty(globalThis, "navigator", origNav);
      else delete (globalThis as Record<string, unknown>).navigator;
      if (origDoc) Object.defineProperty(globalThis, "document", origDoc);
      else delete (globalThis as Record<string, unknown>).document;
    }
  });

  it("returns false when both clipboard and execCommand fail", async () => {
    const origNav = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    const origDoc = Object.getOwnPropertyDescriptor(globalThis, "document");
    try {
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: {},
      });
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: {
          createElement: () => {
            throw new Error("DOM unavailable");
          },
        },
      });
      assert.strictEqual(await copyToClipboard("FAIL-TEXT"), false);
    } finally {
      if (origNav) Object.defineProperty(globalThis, "navigator", origNav);
      else delete (globalThis as Record<string, unknown>).navigator;
      if (origDoc) Object.defineProperty(globalThis, "document", origDoc);
      else delete (globalThis as Record<string, unknown>).document;
    }
  });
});
