export function getBaseUrl(request?: Request): string {
  // 1. Explicit environment variable override if set
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }

  const forwardedHost = request ? request.headers.get("x-forwarded-host") : null;
  const hostHeader = request ? (request.headers.get("host") || "") : "";
  const proto = request ? (request.headers.get("x-forwarded-proto") || "https") : "https";

  let host = forwardedHost || hostHeader;

  // Detect internal container / Cloud Run / loopback / local addresses
  const isLocalOrContainer =
    !host ||
    host.includes("0.0.0.0") ||
    host.includes("127.0.0.1") ||
    host.includes("localhost") ||
    host.includes(":8080") ||
    host.includes(":3000");

  const isCloudEnvironment =
    process.env.NODE_ENV === "production" ||
    !!process.env.K_SERVICE ||
    !!process.env.FIREBASE_CONFIG ||
    host.includes("hosted.app");

  if (isCloudEnvironment || (isLocalOrContainer && process.env.NODE_ENV !== "development")) {
    return "https://dojo--jutsu-classroom-mrtin.us-east4.hosted.app";
  }

  return `http://${host || "localhost:3000"}`;
}
