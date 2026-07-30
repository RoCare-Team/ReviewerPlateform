"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, MapPin, RefreshCw, Star, Trash2 } from "lucide-react";

/**
 * Client UI for connected Google Business Profile accounts. Receives already-
 * serialized connections (with their locations) from the server page and drives
 * the sync / disconnect API routes. Real data — no placeholders here.
 */
export default function GmbConnections({ connections }) {
  const router = useRouter();
  const [busy, setBusy] = useState(null); // connection id currently working
  const [msg, setMsg] = useState(null);

  async function sync(id) {
    setBusy(id);
    setMsg(null);
    const res = await fetch("/api/business/gmb/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId: id }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setMsg({ tone: "error", text: data.error ?? "Sync failed." });
      return;
    }
    const errNote = data.errors?.length ? ` (${data.errors.length} location error(s))` : "";
    setMsg({ tone: "ok", text: `Synced ${data.synced} review(s)${errNote}.` });
    router.refresh();
  }

  async function disconnect(id) {
    if (!confirm("Disconnect this Google account? Its synced locations and reviews will be removed.")) return;
    setBusy(id);
    setMsg(null);
    const res = await fetch(`/api/business/gmb/${id}`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg({ tone: "error", text: data.error ?? "Disconnect failed." });
      return;
    }
    setMsg({ tone: "ok", text: "Disconnected." });
    router.refresh();
  }

  return (
    <div>
      {msg && (
        <div
          className={`mb-4 rounded-btn border px-3 py-2 text-sm ${
            msg.tone === "ok"
              ? "border-verified bg-verified-subtle text-verified"
              : "border-danger bg-danger-subtle text-danger"
          }`}
        >
          {msg.text}
        </div>
      )}

      {connections.length === 0 ? (
        <div className="rounded-card border border-dashed border-default bg-surface-raised p-8 text-center">
          <p className="text-sm text-secondary">No Google account connected yet.</p>
          <a
            href="/api/business/gmb/connect"
            className="mt-4 inline-flex items-center gap-2 rounded-btn bg-accent px-4 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition hover:bg-accent-hover"
          >
            <Image src="/img/google.png" alt="" width={18} height={18} className="h-4 w-4" />
            Connect Google Business Profile
          </a>
        </div>
      ) : (
        <div className="space-y-5">
          {connections.map((c) => (
            <div key={c.id} className="rounded-card border border-default bg-surface-raised p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-default bg-surface">
                    <Image src="/img/google.png" alt="Google" width={22} height={22} className="h-5 w-5 object-contain" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-primary">{c.googleEmail}</p>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-verified">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Connected
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => sync(c.id)}
                    disabled={busy === c.id}
                    className="inline-flex items-center gap-1.5 rounded-btn bg-accent px-3 py-1.5 text-sm font-semibold text-on-brand shadow-sm transition hover:bg-accent-hover disabled:opacity-60"
                  >
                    <RefreshCw className={`h-4 w-4 ${busy === c.id ? "animate-spin" : ""}`} aria-hidden="true" />
                    {busy === c.id ? "Syncing…" : "Sync reviews"}
                  </button>
                  <button
                    type="button"
                    onClick={() => disconnect(c.id)}
                    disabled={busy === c.id}
                    className="inline-flex items-center gap-1.5 rounded-btn border border-default bg-surface px-3 py-1.5 text-sm font-semibold text-danger transition hover:bg-danger-subtle disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Disconnect
                  </button>
                </div>
              </div>

              {c.lastError && (
                <p className="mt-3 rounded-btn bg-danger-subtle px-3 py-2 text-xs text-danger">{c.lastError}</p>
              )}

              {/* Locations under this account */}
              <div className="mt-4 border-t border-default pt-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">
                  Locations ({c.locations.length})
                </p>
                {c.locations.length === 0 ? (
                  <p className="mt-2 text-sm text-secondary">
                    No locations found for this account yet.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {c.locations.map((loc) => (
                      <li
                        key={loc.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-btn border border-default bg-surface px-3 py-2.5"
                      >
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                          <MapPin className="h-4 w-4 text-accent" aria-hidden="true" />
                          {loc.title || loc.locationName}
                          {loc.address && <span className="text-xs font-normal text-muted">· {loc.address}</span>}
                        </span>
                        <span className="inline-flex items-center gap-3 text-xs text-secondary">
                          {loc.reviewCount > 0 && (
                            <span className="inline-flex items-center gap-1 font-semibold text-primary">
                              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
                              {loc.averageRating ? loc.averageRating.toFixed(1) : "—"} · {loc.reviewCount}
                            </span>
                          )}
                          <span className="text-muted">
                            {loc.lastSyncedAt ? `Synced ${loc.lastSyncedAt}` : "Not synced"}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}

          <a
            href="/api/business/gmb/connect"
            className="inline-flex items-center gap-2 rounded-btn border border-default bg-surface px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-surface-sunken"
          >
            <Image src="/img/google.png" alt="" width={18} height={18} className="h-4 w-4" />
            Connect another Google account
          </a>
        </div>
      )}
    </div>
  );
}
