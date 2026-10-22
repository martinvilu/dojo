import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Los tests E2E levantan su propio servidor contra los emuladores sin
  // pisar el build normal (.next).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *;"
          }
        ]
      }
    ];
  }
};

/**
 * Source maps privados en Sentry (mejora 5.07): con SENTRY_AUTH_TOKEN el build
 * los sube y los borra del bundle publicado. Sin token, el build no cambia.
 */
async function withObservability(config: NextConfig): Promise<NextConfig> {
  if (!process.env.SENTRY_AUTH_TOKEN || !process.env.SENTRY_ORG || !process.env.SENTRY_PROJECT) return config;
  const { withSentryConfig } = await import("@sentry/nextjs/config");
  return withSentryConfig(config, {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    silent: true,
    sourcemaps: { deleteSourcemapsAfterUpload: true },
  });
}

export default withObservability(nextConfig);
