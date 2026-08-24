/**
 * Aggregations for the per-student GitHub metrics board. Pure functions so
 * they can be unit-tested and reused by any view holding raw activity data.
 */

export interface CommitLike {
  date: string;
  [k: string]: any;
}

export interface PullLike {
  state: "open" | "closed" | string;
  merged_at?: string | null;
  [k: string]: any;
}

export interface GithubMetrics {
  totalCommits: number;
  weekly: { label: string; count: number }[];
  avgPerActiveWeek: number;
  hours: number[];
  peakHour: number | null;
  nightOwlRatio: number; // % of commits between 20:00-06:00
  prBreakdown: { open: number; closed: number; merged: number };
}

function startOfISOWeek(d: Date): Date {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7; // Mon=1..Sun=7
  date.setUTCDate(date.getUTCDate() - (day - 1));
  return date;
}

export function computeGithubMetrics(commits: CommitLike[], pulls: PullLike[] = []): GithubMetrics {
  const validCommits = (commits || []).filter((c) => c?.date && !isNaN(new Date(c.date).getTime()));
  const hours = new Array(24).fill(0) as number[];
  const weekCounts = new Map<string, number>();

  validCommits.forEach((c) => {
    const d = new Date(c.date);
    hours[d.getHours()] += 1;
    const weekKey = startOfISOWeek(d).toISOString().slice(0, 10);
    weekCounts.set(weekKey, (weekCounts.get(weekKey) || 0) + 1);
  });

  // Last 6 ISO weeks, oldest first, zero-filled.
  const weekly: { label: string; count: number }[] = [];
  const thisWeek = startOfISOWeek(new Date());
  for (let i = 5; i >= 0; i--) {
    const wk = new Date(thisWeek.getTime() - i * 7 * 86400000);
    const key = wk.toISOString().slice(0, 10);
    weekly.push({
      label: `${wk.getUTCDate()}/${wk.getUTCMonth() + 1}`,
      count: weekCounts.get(key) || 0
    });
  }

  const activeWeeks = weekly.filter((w) => w.count > 0).length;
  const peakHour = validCommits.length ? hours.indexOf(Math.max(...hours)) : null;
  const nightCommits = validCommits.filter((c) => {
    const h = new Date(c.date).getHours();
    return h >= 20 || h < 6;
  }).length;

  const prBreakdown = { open: 0, closed: 0, merged: 0 };
  (pulls || []).forEach((p) => {
    if (p.state === "open") prBreakdown.open += 1;
    else if (p.merged_at) prBreakdown.merged += 1;
    else prBreakdown.closed += 1;
  });

  return {
    totalCommits: validCommits.length,
    weekly,
    avgPerActiveWeek: activeWeeks ? Math.round((validCommits.length / activeWeeks) * 10) / 10 : 0,
    hours,
    peakHour,
    nightOwlRatio: validCommits.length ? Math.round((nightCommits / validCommits.length) * 100) : 0,
    prBreakdown
  };
}
