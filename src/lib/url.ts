export function getBaseUrl(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const hostHeader = request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "https";

  let host = forwardedHost || hostHeader || "";

  // If host is empty or points to internal container addresses (0.0.0.0 / 127.0.0.1), use public host
  if (!host || host.includes("0.0.0.0") || host.includes("127.0.0.1")) {
    if (process.env.NEXT_PUBLIC_APP_URL) {
      return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
    }
    return "https://dojo--jutsu-classroom-mrtin.us-east4.hosted.app";
  }

  return `${proto}://${host}`;
}
