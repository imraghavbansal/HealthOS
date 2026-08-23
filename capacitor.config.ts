import type { CapacitorConfig } from "@capacitor/cli";

// Points the native WebView at the live production deployment rather than
// bundling a static export of the app. Deliberate choice, not a shortcut:
// TanStack Start's Nitro server does real SSR (auth cookie handling, meta
// tags, streaming) that a static-export pipeline would need to either
// replicate or drop — a bigger, separate engineering effort. This gets a
// real native shell (App Store/Play Store distributable, native push via
// @capacitor/push-notifications, native APIs) shipped now; a true
// offline-first bundle with a local encrypted cache is explicitly a later,
// separate V3 line item (see docs/PRODUCT-VISION.md), not something this
// config quietly skips.
//
// Trade-off this implies: the app needs network connectivity to load at
// all, same as the web version — there is no offline mode yet, consistent
// with the service worker (public/sw.js) also deliberately not caching
// for offline use.
const config: CapacitorConfig = {
  appId: "app.raag.health",
  appName: "Raag",
  webDir: "dist", // unused with server.url below, but required by the CapacitorConfig type
  server: {
    url: "https://raag-health.vercel.app",
    cleartext: false,
  },
};

export default config;
