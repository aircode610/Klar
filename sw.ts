/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  Serwist,
  StaleWhileRevalidate,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // API GETs: network-first, fall back to cache when offline (cached letters
    // and deadlines stay viewable).
    {
      matcher: ({ url, request }) =>
        request.method === "GET" && url.pathname.includes("/v1/"),
      handler: new NetworkFirst({
        cacheName: "klar-api",
        networkTimeoutSeconds: 5,
        plugins: [
          new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 }),
        ],
      }),
    },
    // Web fonts (Fontshare): cache-first, long-lived.
    {
      matcher: ({ url }) => url.hostname.includes("fontshare"),
      handler: new CacheFirst({
        cacheName: "klar-fonts",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 16,
            maxAgeSeconds: 60 * 60 * 24 * 365,
          }),
        ],
      }),
    },
    // Images / letter thumbnails: stale-while-revalidate.
    {
      matcher: ({ request }) => request.destination === "image",
      handler: new StaleWhileRevalidate({
        cacheName: "klar-images",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 64,
            maxAgeSeconds: 60 * 60 * 24 * 30,
          }),
        ],
      }),
    },
    ...defaultCache,
  ],
  // Offline fallback for navigations.
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
