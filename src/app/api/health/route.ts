import { NextResponse } from "next/server";
import { adminDb } from "../middleware/api";
import { healthHttpStatus, runHealthChecks, type Probe } from "@/lib/health";

export const dynamic = "force-dynamic";

/**
 * Health endpoint for uptime monitors (Uptime Kuma, Pingdom, Cloud Monitoring).
 *
 *   GET /api/health         -> liveness + Firestore read (required)
 *   GET /api/health?deep=1  -> also probes the GitHub API (optional)
 *
 * Responds 200 when the platform can serve users ("ok" or "degraded") and
 * 503 when a required dependency is down. The body never includes error
 * messages, credentials or document contents.
 */
export async function GET(request: Request) {
  const deep = new URL(request.url).searchParams.get("deep") === "1";

  const probes: Probe[] = [
    {
      name: "firestore",
      // Point read of a small, always-present document.
      run: () => adminDb().collection("globals").doc("settings").get(),
    },
  ];

  if (deep) {
    probes.push({
      name: "github_api",
      required: false,
      // /rate_limit does not consume the unauthenticated quota.
      run: async () => {
        const res = await fetch("https://api.github.com/rate_limit", {
          headers: { "User-Agent": "Jutsu-Classroom-Health" },
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      },
    });
  }

  const report = await runHealthChecks(probes);
  return NextResponse.json(report, {
    status: healthHttpStatus(report),
    headers: { "Cache-Control": "no-store" },
  });
}

export async function HEAD(request: Request) {
  const res = await GET(request);
  return new Response(null, { status: res.status, headers: { "Cache-Control": "no-store" } });
}
