"use client";

import * as React from "react";

/** Registers the service worker in production builds only. */
export function ServiceWorkerRegister() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Non-fatal: the app works without offline caching.
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}

/** Clears cached pages (called on sign-out so household data isn't left on shared devices). */
export async function clearCachedPages(): Promise<void> {
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_USER_CACHE" });
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("homebase-pages")).map((k) => caches.delete(k)));
    }
  } catch {
    // ignore
  }
}
