import type { Metadata, Viewport } from "next";
import "./globals.css";
import { spaceMono } from "./fonts";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "Klar",
  description: "Understand any German official letter.",
  applicationName: "Klar",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Klar",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2EEE4" },
    { media: "(prefers-color-scheme: dark)", color: "#14110B" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * Sets data-theme / lang / dir on <html> before first paint, reading the
 * persisted store so there is no theme/RTL flash.
 */
const themeInitScript = `
(function () {
  try {
    var raw = localStorage.getItem('klar-app');
    var s = raw ? (JSON.parse(raw).state || {}) : {};
    var theme = s.theme || 'light';
    var lang = s.lang || '${process.env.NEXT_PUBLIC_DEFAULT_LANG || "en"}';
    var rtl = lang === 'fa' || lang === 'ar';
    var el = document.documentElement;
    el.setAttribute('data-theme', theme);
    el.setAttribute('lang', lang);
    el.setAttribute('dir', rtl ? 'rtl' : 'ltr');
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${spaceMono.variable} antialiased`}>
        <Providers>{children}</Providers>
        <div className="grain-overlay" aria-hidden />
      </body>
    </html>
  );
}
