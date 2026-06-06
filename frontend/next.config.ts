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
