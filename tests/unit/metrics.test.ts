import { describe, it } from "node:test";
import assert from "node:assert";
import { computeGithubMetrics } from "../../src/modules/github/utils/metrics.ts";
import { getWeeklyClasses } from "../../src/app/dashboard/utils/weeklyClasses.ts";

describe("src/modules/github/utils/metrics", () => {
  it("returns zeroed metrics for empty inputs", () => {
    const m = computeGithubMetrics([], []);
    assert.strictEqual(m.totalCommits, 0);
    assert.strictEqual(m.weekly.length, 6);
    assert.strictEqual(m.avgPerActiveWeek, 0);
    assert.strictEqual(m.peakHour, null);
    assert.strictEqual(m.nightOwlRatio, 0);
    assert.deepStrictEqual(m.prBreakdown, { open: 0, closed: 0, merged: 0 });
  });

  it("computes commit distribution, night owl ratio, and PR breakdown", () => {
    const now = new Date();
    const lateEvening = new Date(now);
    lateEvening.setHours(22, 15, 0, 0);
    const afternoon = new Date(now);
    afternoon.setHours(14, 0, 0, 0);

    const commits = [
      { date: lateEvening.toISOString() },
      { date: lateEvening.toISOString() },
      { date: afternoon.toISOString() },
      { date: "invalid-date" },
    ];
    const pulls = [
      { state: "open" },
      { state: "closed", merged_at: "2026-04-01T00:00:00Z" },
      { state: "closed", merged_at: null },
    ];

    const m = computeGithubMetrics(commits, pulls);
    assert.strictEqual(m.totalCommits, 3);
    assert.strictEqual(m.peakHour, 22);
    assert.strictEqual(m.nightOwlRatio, 67);
    assert.strictEqual(m.avgPerActiveWeek, 3);
    assert.deepStrictEqual(m.prBreakdown, { open: 1, closed: 1, merged: 1 });
  });
});

describe("src/app/dashboard/utils/weeklyClasses", () => {
  it("returns empty object when classes list is empty", () => {
    assert.deepStrictEqual(getWeeklyClasses([]), {});
  });

  it("groups class instances by week relative to the first class Monday", () => {
    const classes = [
      { id: "c1", title: "Clase 1", date: "2026-03-15T00:00:00Z" }, // Sunday of week 1
      { id: "c2", title: "Clase 2", date: "2026-03-17T00:00:00Z" }, // Tuesday of week 2
      { id: "c3", title: "Clase 3", date: "2026-03-19T00:00:00Z" }, // Thursday of week 2
    ] as any[];

    const grouped = getWeeklyClasses(classes);
    assert.strictEqual(grouped[1]?.length, 1);
    assert.strictEqual(grouped[2]?.length, 2);
  });
});
