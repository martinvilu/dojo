import { describe, it } from "node:test";
import assert from "node:assert";
import { createSwrCache, cacheKey } from "../../src/lib/swrCache.ts";

describe("swrCache", () => {
  it("serves fresh values and refetches stale ones", async () => {
    let t = 0;
    const cache = createSwrCache(() => t);
    let calls = 0;
    const fetcher = async () => ++calls;
    assert.strictEqual(await cache.get("k", fetcher, 1000), 1);
    t = 500;
    assert.strictEqual(await cache.get("k", fetcher, 1000), 1);
    t = 1500;
    assert.strictEqual(cache.peek("k"), 1, "stale value still visible while revalidating");
    assert.strictEqual(await cache.get("k", fetcher, 1000), 2);
  });

  it("dedupes concurrent requests and does not cache failures", async () => {
    const cache = createSwrCache(() => 0);
    let calls = 0;
    const slow = () => new Promise<number>((r) => setTimeout(() => r(++calls), 5));
    const [a, b] = await Promise.all([cache.get("k", slow), cache.get("k", slow)]);
    assert.deepStrictEqual([a, b, calls], [1, 1, 1]);

    await assert.rejects(cache.get("x", async () => { throw new Error("boom"); }));
    assert.strictEqual(await cache.get("x", async () => "ok"), "ok");
  });

  it("invalidates by prefix", async () => {
    const cache = createSwrCache(() => 0);
    await cache.get(cacheKey("getCourseRoster", { courseId: "c1" }), async () => 1);
    await cache.get(cacheKey("getAssessments", { courseId: "c1" }), async () => 2);
    cache.invalidate("getCourseRoster:");
    assert.strictEqual(cache.size(), 1);
    assert.strictEqual(cacheKey("a", undefined), "a:{}");
  });
});
