import { Space_Mono } from "next/font/google";

/**
 * Space Mono carries the "real paperwork" texture: reference numbers, document
 * IDs, countdowns, uppercase labels, stamp text, and original-German snippets.
 * Clash Display + General Sans load via Fontshare (@import in globals.css).
 */
export const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});
