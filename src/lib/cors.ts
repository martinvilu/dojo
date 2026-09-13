/**
 * CORS helper for Next.js API Routes and webhooks.
 * Validates requests against an explicit whitelist of trusted origins
 * (educational institution domains and the application canonical hosting URL).
 */

const ALLOWED_ORIGINS = new Set([
  "https://dojo--jutsu-classroom-mrtin.us-east4.hosted.app",
  "https://moodle.unrn.edu.ar",
  "https://moodle.unrn.edu",
]);

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true; // Direct server-to-server or curl requests
  if (ALLOWED_ORIGINS.has(origin)) return true;

  if (process.env.NEXT_PUBLIC_APP_URL && origin === process.env.NEXT_PUBLIC_APP_URL) {
    return true;
  }

  // Allow localhost during local development
  if (process.env.NODE_ENV !== "production") {
    if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
      return true;
    }
  }

  return false;
}

export function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, X-Hub-Signature-256",
    "Access-Control-Max-Age": "86400",
  };

  if (origin && isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  return headers;
}

export function handleCorsPreflight(request: Request): Response | null {
  if (request.method.toUpperCase() === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request),
    });
  }
  return null;
}
