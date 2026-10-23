"use client";
import { useEffect } from "react";

// Switches on public/sw.js so the app can be installed and opened offline.
// Production only: in development a cached copy would hide code changes.
export default function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("Offline support could not start:", err);
    });
  }, []);
  return null;
}
