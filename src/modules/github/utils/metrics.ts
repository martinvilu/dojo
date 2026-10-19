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

// Weeks are bucketed in local time, like `hours`, so a late-evening commit
// on Sunday is not pushed into the next week for viewers west of UTC.
function startOfISOWeek(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay() || 7; // Mon=1..Sun=7
  date.setDate(date.getDate() - (day - 1));
  return date;
}

function weekKeyOf(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function computeGithubMetrics(commits: CommitLike[], pulls: PullLike[] = []): GithubMetrics {
  const validCommits = (commits || []).filter((c) => c?.date && !isNaN(new Date(c.date).getTime()));
  const hours = new Array(24).fill(0) as number[];
  const weekCounts = new Map<string, number>();

  validCommits.forEach((c) => {
    const d = new Date(c.date);
    hours[d.getHours()] += 1;
    const weekKey = weekKeyOf(startOfISOWeek(d));
    weekCounts.set(weekKey, (weekCounts.get(weekKey) || 0) + 1);
  });

  // Last 6 ISO weeks, oldest first, zero-filled.
  const weekly: { label: string; count: number }[] = [];
  const thisWeek = startOfISOWeek(new Date());
  for (let i = 5; i >= 0; i--) {
    const wk = new Date(thisWeek.getFullYear(), thisWeek.getMonth(), thisWeek.getDate() - i * 7);
    weekly.push({
      label: `${wk.getDate()}/${wk.getMonth() + 1}`,
      count: weekCounts.get(weekKeyOf(wk)) || 0
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
