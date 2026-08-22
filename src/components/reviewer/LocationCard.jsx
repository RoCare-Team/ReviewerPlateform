"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, MapPin } from "lucide-react";
import StateCitySelect from "../ui/StateCitySelect";
import { findStateForCity } from "../../lib/data/indiaStatesCities";
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
 * Display + edit of the reviewer's declared city. Set mandatorily at signup
 * (PhoneOtpForm.jsx) — this is only for changing it later (moved cities).
 * Deliberately a manual State/City picker, NOT browser geolocation: this app
 * never asks for location access at all anymore, see api/reviewer/location.
 */
export default function LocationCard({ city, updatedAt }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [state, setState] = useState(() => findStateForCity(city) ?? "");
  const [pickedCity, setPickedCity] = useState(city ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!pickedCity.trim()) {
      setError("Select your city.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const res = await fetch("/api/reviewer/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: pickedCity.trim() }),
      });
      if (!res.ok) throw new Error();
      toast.success("City updated.");
      setEditing(false);
      router.refresh();
    } catch {
      setError("Couldn't save your city. Try again.");
    } finally {
      setPending(false);
    }
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
            <h2 className="text-sm font-bold uppercase tracking-wide text-secondary">Your city</h2>
            <p className="text-xs text-muted">Used to match you with nearby campaigns</p>
          </div>
        </div>

        {!editing && (
          <button
            type="button"
            onClick={() => {
              setState(findStateForCity(city) ?? "");
              setPickedCity(city ?? "");
              setError("");
              setEditing(true);
            }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-btn border border-default bg-surface px-3.5 py-2 text-sm font-semibold text-secondary shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:text-accent"
          >
            Change
          </button>
        )}
      </div>

      <div className="px-6 py-5 sm:px-8">
        {editing ? (
          <div className="animate-fade-up" style={{ animationDuration: "200ms" }}>
            <StateCitySelect
              idPrefix="profile-city"
              state={state}
              city={pickedCity}
              onStateChange={(s) => { setState(s); setPickedCity(""); }}
              onCityChange={setPickedCity}
            />
            {error && (
              <p className="mt-3 flex items-start gap-1.5 text-sm text-danger">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={save}
                disabled={pending}
                className="rounded-btn bg-accent px-4 py-2 text-sm font-semibold text-on-brand shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={pending}
                className="rounded-btn border border-default bg-surface px-4 py-2 text-sm font-semibold text-secondary transition-colors duration-200 hover:bg-surface-sunken"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : city ? (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <p className="text-2xl font-bold tracking-tight text-primary">{city}</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-verified-subtle px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-verified">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                Set
              </span>
            </div>
            {updatedAt && <p className="mt-2 text-xs text-muted">Updated {timeAgo(updatedAt)}</p>}
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Campaigns are only shown to you from this city. Moved recently? Tap Change above.
            </p>
          </>
        ) : (
          <p className="text-sm text-secondary">No city set yet — tap Change to pick one.</p>
        )}
      </div>
    </div>
  );
}
