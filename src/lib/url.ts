export function getBaseUrl(request: Request): string {
  // 1. Explicit environment variable override if set
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const hostHeader = request.headers.get("host") || "";
  const proto = request.headers.get("x-forwarded-proto") || "https";

  let host = forwardedHost || hostHeader;

  // Check if host matches internal container / loopback / local addresses
  const isLocalOrContainer =
    !host ||
    host.includes("0.0.0.0") ||
    host.includes("127.0.0.1") ||
    host.includes("localhost") ||
    host.includes(":8080");

  if (isLocalOrContainer) {
    // In production build or deployed cloud environment, force the canonical public domain
    if (process.env.NODE_ENV === "production") {
      return "https://dojo--jutsu-classroom-mrtin.us-east4.hosted.app";
    }
    // In local development, use localhost with HTTP
    const localPort = host.includes(":") ? host.split(":")[1] : "3000";
    return `http://localhost:${localPort === "8080" ? "3000" : localPort}`;
  }

  return `${proto}://${host}`;
}
