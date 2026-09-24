/**
 * Health checks for /api/health (mejora 3.50).
 *
 * Each probe runs with its own timeout; the report is "ok" only when every
 * required probe passes. Optional probes (external services the platform
 * can live without for a while, like the GitHub API) degrade the report
 * but never make it "down".
 */

export type ProbeStatus = "ok" | "error" | "timeout";

export interface ProbeResult {
  status: ProbeStatus;
  latency_ms: number;
  required: boolean;
  error?: string;
}

export interface HealthReport {
  status: "ok" | "degraded" | "down";
  timestamp: string;
  checks: Record<string, ProbeResult>;
}

export interface Probe {
  name: string;
  run: () => Promise<unknown>;
  required?: boolean;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 3000;

class ProbeTimeout extends Error {}

async function runProbe(probe: Probe, now: () => number): Promise<ProbeResult> {
  const started = now();
  const required = probe.required ?? true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      probe.run(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new ProbeTimeout()), probe.timeoutMs ?? DEFAULT_TIMEOUT_MS);
      }),
    ]);
    return { status: "ok", latency_ms: now() - started, required };
  } catch (error) {
    const timedOut = error instanceof ProbeTimeout;
    return {
      status: timedOut ? "timeout" : "error",
      latency_ms: now() - started,
      required,
      // Only the error class is exposed: messages may carry internal details.
      ...(timedOut ? {} : { error: error instanceof Error ? error.name : "Error" }),
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function runHealthChecks(probes: Probe[], now: () => number = Date.now): Promise<HealthReport> {
  const results = await Promise.all(probes.map((probe) => runProbe(probe, now)));
  const checks: Record<string, ProbeResult> = {};
  probes.forEach((probe, index) => {
    checks[probe.name] = results[index];
  });

  const failed = results.filter((r) => r.status !== "ok");
  const status = failed.some((r) => r.required) ? "down" : failed.length > 0 ? "degraded" : "ok";
  return { status, timestamp: new Date().toISOString(), checks };
}

/** HTTP status for monitors: 503 only when a required dependency is down. */
export function healthHttpStatus(report: HealthReport): number {
  return report.status === "down" ? 503 : 200;
}
