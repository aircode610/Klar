import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray package-lock.json in the home directory makes Next mis-infer the
  // workspace root; pin it to this project.
  outputFileTracingRoot: __dirname,
  async redirects() {
    // Land on the home (Letters) screen. Onboarding gating comes in Phase 4.
    return [{ source: "/", destination: "/letters", permanent: false }];
  },
  async rewrites() {
    // Reverse-proxy backend calls so the browser only ever sees the frontend
    // origin. Without this the browser treats the ngrok backend subdomain as
    // a third-party site and modern browsers (iOS Safari ITP, Chrome on
    // mobile) block the SameSite=None session cookie — login succeeds, the
    // next /auth/me 401s, and the app kicks the user back to /login.
    //
    // BACKEND_URL is server-side only (NOT NEXT_PUBLIC_) so the value never
    // leaks into the bundle and the browser stays unaware of the upstream.
    // Set BACKEND_URL in .env.local; when unset (e.g. production where the
    // backend is co-located), the rewrite is a no-op.
    const backend = process.env.BACKEND_URL;
    if (!backend) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${backend.replace(/\/$/, "")}/:path*`,
      },
    ];
  },
};

const withSerwist = withSerwistInit({
  swSrc: "sw.ts",
  swDest: "public/sw.js",
  // Disabled in dev so the service worker never caches against you while building.
  disable: process.env.NODE_ENV !== "production",
  // We register the SW manually in Providers, only when NOT in mock mode, so it
  // never competes for scope with MSW's own service worker.
  register: false,
});

export default withSerwist(nextConfig);
