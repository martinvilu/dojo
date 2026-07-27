export function getBaseUrl(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const hostHeader = request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || (process.env.NODE_ENV === "production" ? "https" : "http");

  let host = forwardedHost || hostHeader;

  if (!host || host.includes("0.0.0.0")) {
    if (process.env.NEXT_PUBLIC_APP_URL) {
      return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
    }
    if (process.env.NODE_ENV === "production") {
      host = "dojo--jutsu-classroom-mrtin.us-east4.hosted.app";
    } else {
      host = host ? host.replace("0.0.0.0", "localhost") : "localhost:3000";
    }
  }

  return `${proto}://${host}`;
}
