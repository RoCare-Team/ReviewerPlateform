"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, MapPin, RefreshCcw } from "lucide-react";
import { toast } from "../../lib/toast";

/** "2 hours ago" / "3 days ago" — short and skimmable, exact time is a step too far for this. */
function timeAgo(date) {
  const diffMs = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Read-only display of the reviewer's current saved location, plus a manual
 * "Update" action for when they've actually moved cities. The location
 * itself is never editable as text — it only ever comes from
 * navigator.geolocation (see LocationGate.jsx, the mandatory first-time
 * capture) so it can't drift from reality the way a free-text field could.
 */
export default function LocationCard({ city, address, updatedAt }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  function refresh() {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setError("Your browser doesn't support location access.");
      return;
    }
    setPending(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch("/api/reviewer/location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          });
          if (!res.ok) throw new Error();
          toast.success("Location updated.");
          router.refresh();
        } catch {
          setError("Couldn't save your location. Try again.");
        } finally {
          setPending(false);
        }
      },
      (err) => {
        setPending(false);
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location access is blocked — allow it in your browser's site settings."
            : "Couldn't get your location. Try again."
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
    );
  }

  return (
    <div className="overflow-hidden rounded-card border border-default bg-surface-raised shadow-sm transition-shadow duration-300 hover:shadow-md">
      {/* Header band — same "icon in a soft tint" language as WalletCard/
          CampaignCard, but with a map-pin motif of its own so this reads as
          its own section, not a leftover form field. */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-default bg-linear-to-r from-accent-subtle to-transparent px-6 py-5 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-on-brand shadow-sm">
            <MapPin className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-secondary">Current location</h2>
            <p className="text-xs text-muted">Used to match you with nearby campaigns</p>
          </div>
        </div>

        <button
          type="button"
          onClick={refresh}
          disabled={pending}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-btn border border-default bg-surface px-3.5 py-2 text-sm font-semibold text-secondary shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {pending ? "Updating…" : "Update"}
        </button>
      </div>

      <div className="px-6 py-5 sm:px-8">
        {city ? (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <p className="text-2xl font-bold tracking-tight text-primary">{city}</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-verified-subtle px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-verified">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                Detected
              </span>
            </div>
            {address && address !== city && <p className="mt-1 text-sm text-secondary">{address}</p>}
            {updatedAt && <p className="mt-2 text-xs text-muted">Updated {timeAgo(updatedAt)}</p>}
          </>
        ) : (
          <p className="text-sm text-secondary">Not detected yet — tap Update to fetch it.</p>
        )}

        <p className="mt-3 text-xs leading-relaxed text-muted">
          Campaigns are only shown to you from this city. Moved recently? Tap Update to refresh it.
        </p>

        {error && (
          <p className="mt-3 flex items-start gap-1.5 rounded-btn border border-danger bg-danger-subtle px-3 py-2.5 text-sm text-danger">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}
      </div>
    </div>
  );
}
