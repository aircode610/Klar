import type { MetadataRoute } from "next";

/**
 * PWA manifest (CLAUDE.md Section 6). Icons use the KLAR stamp mark.
 * Note: SVG icons are used for now; PNG raster icons + iOS splash screens are a
 * Phase 5 polish task.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Klar",
    short_name: "Klar",
    description: "Understand any German official letter.",
    display: "standalone",
    orientation: "portrait",
    start_url: "/letters",
    scope: "/",
    background_color: "#F2EEE4",
    theme_color: "#16120C",
    categories: ["productivity", "utilities"],
    icons: [
      { src: "/icon.svg", sizes: "192x192", type: "image/svg+xml" },
      { src: "/icon.svg", sizes: "512x512", type: "image/svg+xml" },
      {
        src: "/icon-maskable.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
