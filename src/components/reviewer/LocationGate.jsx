"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, LocateFixed, MapPinned, ShieldCheck, Sparkles } from "lucide-react";
import SignOutButton from "../auth/SignOutButton";
import { toast } from "../../lib/toast";

const REASONS = [
  { text: "See campaigns available in your own city" },
  { text: "Takes two seconds — no typing, no forms" },
  { text: "Used only for matching, never shown publicly" },
];

/**
 * Full-screen, mandatory location gate — renders INSTEAD of the reviewer
 * shell (see (app)/reviewer/layout.jsx) whenever User.location.city is
 * still empty. A reviewer cannot reach any /reviewer/* page, including
 * campaigns, without granting location access at least once: campaigns are
 * matched to reviewers by city (see reviewer/campaigns/page.jsx and the
 * `city` field on Campaign), so a reviewer with no known city would either
 * see nothing relevant or everything indiscriminately.
 *
 * This replaces the old best-effort LocationCapture (fire-and-forget,
 * silently gave up on denial) — denial here just re-shows the same screen
 * with a way to retry, since the location genuinely can't be skipped.
 *
 * On success: POSTs to /api/reviewer/location (same endpoint as before,
 * unchanged — reverse-geocodes server-side), then router.refresh() so the
 * server layout re-reads User.location.city and renders the real shell.
 */
export default function LocationGate() {
  const router = useRouter();
  const [status, setStatus] = useState("idle"); // idle | requesting | denied | unsupported | error
  const [errorMessage, setErrorMessage] = useState("");

  function requestLocation() {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      return;
    }

    setStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch("/api/reviewer/location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            }),
          });
          if (!res.ok) throw new Error();
          toast.success("Location saved.");
          router.refresh();
        } catch {
          setStatus("error");
          setErrorMessage("Couldn't save your location. Check your connection and try again.");
        }
      },
      (err) => {
        setStatus("denied");
        setErrorMessage(
          err.code === err.PERMISSION_DENIED
            ? "Location access was denied. Allow it in your browser's site settings, then try again."
            : "Couldn't get your location. Make sure location services are turned on, then try again."
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
    );
  }

  const failed = status === "denied" || status === "error" || status === "unsupported";
  const requesting = status === "requesting";

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-surface-sunken p-4">
      {/* Soft ambient glow behind the card — purely decorative, gives the
          gate some presence instead of a flat centered box on a flat page. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute -right-24 bottom-1/4 h-72 w-72 rounded-full bg-verified/10 blur-3xl" />
      </div>

      <div
        className="animate-fade-up relative w-full max-w-md overflow-hidden rounded-card border border-default bg-surface-raised shadow-xl"
        style={{ animationDuration: "300ms" }}
      >
        {/* Header band — the animated pin is the focal point new reviewers
            land on; concentric pulse rings read as "searching" even before
            they've clicked anything. */}
        <div className="relative flex flex-col items-center overflow-hidden border-b border-default bg-linear-to-b from-accent-subtle to-transparent px-6 pb-7 pt-8 text-center sm:px-8">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/25" style={{ animationDuration: "2.2s" }} />
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/15"
              style={{ animationDuration: "2.2s", animationDelay: "0.6s" }}
            />
            <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-accent text-on-brand shadow-lg shadow-accent/30">
              <MapPinned className="h-7 w-7" aria-hidden="true" />
            </span>
          </div>

          <h1 className="mt-4 text-xl font-bold tracking-tight text-primary">One quick step to start</h1>
          <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-secondary">
            Share your current location so we can show you campaigns near you.
          </p>
        </div>

        <div className="px-6 py-6 sm:px-8">
          <ul className="space-y-2.5">
            {REASONS.map((r) => (
              <li key={r.text} className="flex items-start gap-2.5 text-sm text-secondary">
                <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-verified-subtle text-verified">
                  <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                </span>
                {r.text}
              </li>
            ))}
          </ul>

          {failed && (
            <div className="mt-5 flex items-start gap-2.5 rounded-btn border border-danger bg-danger-subtle px-3.5 py-3 text-left text-sm text-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                {status === "unsupported"
                  ? "Your browser doesn't support location access. Try a different browser."
                  : errorMessage}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={requestLocation}
            disabled={requesting || status === "unsupported"}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-btn bg-accent px-4 py-3.5 text-sm font-semibold text-on-brand shadow-md shadow-accent/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-lg hover:shadow-accent/25 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-md"
          >
            {requesting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Getting your location…
              </>
            ) : failed ? (
              <>
                <LocateFixed className="h-4 w-4" aria-hidden="true" />
                Try again
              </>
            ) : (
              <>
                <LocateFixed className="h-4 w-4" aria-hidden="true" />
                Allow location access
              </>
            )}
          </button>

          <p className="mt-3.5 flex items-center justify-center gap-1.5 text-center text-xs text-muted">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-verified" aria-hidden="true" />
            Private — used only to match you with nearby campaigns.
          </p>

          <div className="mt-5 flex items-center justify-center gap-3 border-t border-default pt-4 text-xs">
            <span className="text-muted">Wrong account?</span>
            <SignOutButtonInline />
          </div>
        </div>
      </div>
    </div>
  );
}

// Slim inline variant of SignOutButton for this footer — the full-width
// list-item styling SignOutButton normally has (for the app shell's sidebar)
// doesn't belong in a one-line "wrong account?" footer.
function SignOutButtonInline() {
  return (
    <span className="[&>button]:w-auto [&>button]:justify-start [&>button]:gap-1 [&>button]:rounded-none [&>button]:p-0 [&>button]:text-xs [&>button]:font-semibold [&>button]:text-accent [&>button]:hover:bg-transparent [&>button]:hover:text-accent-hover [&>button]:hover:underline">
      <SignOutButton callbackUrl="/login" />
    </span>
  );
}
