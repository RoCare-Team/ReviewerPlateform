"use client";

import { useEffect } from "react";

// Once per browser tab session — avoids re-prompting for location permission
// on every dashboard visit/navigation within the same session.
const SESSION_FLAG = "rl_location_captured";

/**
 * Best-effort, invisible: grabs the reviewer's current location via the
 * browser's own navigator.geolocation (free, no API key) and saves it to
 * /api/reviewer/location, which reverse-geocodes it into an address
 * server-side (src/lib/googleMaps.js). Renders nothing — a denied/failed
 * permission just means no location gets saved, never an error the reviewer
 * has to deal with.
 */
export default function LocationCapture() {
  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) return;
    if (sessionStorage.getItem(SESSION_FLAG)) return;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        sessionStorage.setItem(SESSION_FLAG, "1");
        try {
          await fetch("/api/reviewer/location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            }),
          });
        } catch {
          // Best-effort — a failed save here shouldn't affect the dashboard.
        }
      },
      () => {
        // Permission denied or unavailable — don't ask again this session.
        sessionStorage.setItem(SESSION_FLAG, "1");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 15 * 60 * 1000 }
    );
  }, []);

  return null;
}
