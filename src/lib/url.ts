/**
 * Canonical public URL for the application.
 * This is the ONLY URL that external services (Moodle LTI, calendars, etc.)
 * should ever receive. Internal container addresses (0.0.0.0, localhost, :8080)
 * must NEVER leak to external consumers.
 */
const CANONICAL_URL = "https://dojo--jutsu-classroom-mrtin.us-east4.hosted.app";

/**
 * Returns the public-facing base URL for the application.
 * In production or cloud environments, ALWAYS returns the canonical URL.
 * Only returns a local URL in explicit local development (NODE_ENV=development
 * and no cloud environment variables present).
 */
export function getBaseUrl(request?: Request): string {
  // 1. Explicit environment variable override
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) {
    const cleaned = envUrl.replace(/\/$/, "");
    // Sanitize: if the env var itself contains an internal address, ignore it
    if (!isInternalAddress(cleaned)) {
      return cleaned;
    }
  }

  // 2. Try to resolve from request headers
  const forwardedHost = request?.headers.get("x-forwarded-host") ?? null;
  const hostHeader = request?.headers.get("host") ?? "";
  const proto = request?.headers.get("x-forwarded-proto") ?? "https";
  const host = forwardedHost || hostHeader;

  // 3. If host looks like a real public domain, use it
  if (host && !isInternalAddress(host) && host.includes(".")) {
    return `${proto}://${host}`;
  }

  // 4. In strict local development mode, return localhost
  if (process.env.NODE_ENV === "development" && !process.env.K_SERVICE && !process.env.FIREBASE_CONFIG) {
    const port = host?.includes(":") ? host.split(":")[1] : "3000";
    return `http://localhost:${port === "8080" ? "3000" : port}`;
  }

  // 5. Default: canonical production URL (covers Cloud Run, App Hosting, SSR, etc.)
  return CANONICAL_URL;
}

function isInternalAddress(value: string): boolean {
  return (
    value.includes("0.0.0.0") ||
    value.includes("127.0.0.1") ||
    value.includes("localhost") ||
    value.includes(":8080") ||
    value === ""
  );
}
