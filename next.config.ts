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

export default nextConfig;
