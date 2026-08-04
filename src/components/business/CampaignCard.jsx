"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CheckCircle2, IndianRupee, Link2, Pause, Play, Target } from "lucide-react";

const STATUS_STYLES = { active: "pill-verified", paused: "pill-pending", draft: "pill-accent", completed: "pill-accent" };
const PLATFORM_LABEL = { google: "Google", trustpilot: "Trustpilot", capterra: "Capterra", amazon: "Amazon", playstore: "Play Store" };

function inr(n) {
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

/**
 * A single campaign card with a close/reopen toggle. Closing sets the
 * campaign to "paused" server-side — it stops showing on the reviewer
 * dashboard and can no longer accept new submissions immediately.
 */
export default function CampaignCard({ campaign }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const c = campaign;
  const pct = c.targetReviews ? Math.min(100, Math.round((c.collected / c.targetReviews) * 100)) : 0;
  const canToggle = c.status === "active" || c.status === "paused";
  const action = c.status === "active" ? "pause" : "activate";

  async function toggle() {
    setPending(true);
    setError("");
    const res = await fetch(`/api/business/campaigns/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setPending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't update the campaign.");
      return;
    }
    setConfirming(false);
    router.refresh();
  }

  return (
    <div className="rounded-card border border-default bg-surface-raised p-6 shadow-sm transition-all duration-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-primary">{c.name}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-medium text-muted">
            <span>{PLATFORM_LABEL[c.platform] ?? c.platform}</span>
            {c.createdAt && (
              <span className="inline-flex items-center gap-1">
                <span aria-hidden="true">·</span>
                <CalendarDays className="h-3 w-3" aria-hidden="true" />
                Created{" "}
                {new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
          </p>
        </div>
        <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[c.status]}`}>
          {c.status}
        </span>
      </div>

      {c.notes && <p className="mt-3 text-sm leading-relaxed text-secondary">{c.notes}</p>}

      {c.targetUrl && (
        <a
          href={c.targetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex max-w-full items-center gap-1.5 truncate text-sm font-semibold text-accent hover:underline"
          title={c.targetUrl}
        >
          <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{c.targetUrl}</span>
        </a>
      )}

      <div className="mt-5">
        <div className="flex items-center justify-between text-xs font-medium text-secondary">
          <span className="nums">{c.collected} / {c.targetReviews} reviews</span>
          <span className="nums">{pct}%</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-sunken">
          <div
            className={`h-full rounded-full transition-all duration-500 ${c.status === "paused" ? "bg-pending" : "bg-accent"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-4 text-sm">
        <div>
          <dt className="flex items-center gap-1 text-muted"><IndianRupee className="h-3 w-3" aria-hidden="true" />Budget</dt>
          <dd className="nums mt-0.5 font-bold text-primary">{inr(c.budget)}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-muted"><CheckCircle2 className="h-3 w-3" aria-hidden="true" />Rate</dt>
          <dd className="nums mt-0.5 font-bold text-primary">{inr(c.ratePerReview)}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-muted"><Target className="h-3 w-3" aria-hidden="true" />Target</dt>
          <dd className="nums mt-0.5 font-bold text-primary">{c.targetReviews}</dd>
        </div>
      </dl>

      {canToggle && (
        <div className="mt-5 border-t border-default pt-4">
          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className={
                c.status === "active"
                  ? "inline-flex items-center gap-2 rounded-btn border border-danger-subtle bg-danger-subtle px-3.5 py-2 text-sm font-semibold text-danger transition hover:bg-danger/10"
                  : "inline-flex items-center gap-2 rounded-btn border border-strong bg-surface px-3.5 py-2 text-sm font-semibold text-primary transition hover:bg-surface-sunken"
              }
            >
              {c.status === "active" ? (
                <>
                  <Pause className="h-4 w-4" aria-hidden="true" />
                  Close campaign
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" aria-hidden="true" />
                  Reopen campaign
                </>
              )}
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-secondary">
                {c.status === "active"
                  ? "Stop collecting reviews for this campaign?"
                  : "Start collecting reviews again?"}
              </span>
              <button
                type="button"
                onClick={toggle}
                disabled={pending}
                className="rounded-btn bg-accent px-3.5 py-2 text-sm font-semibold text-on-brand shadow-sm transition hover:bg-accent-hover disabled:opacity-60"
              >
                {pending ? "Working…" : "Yes, confirm"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={pending}
                className="rounded-btn border border-default bg-surface px-3.5 py-2 text-sm font-semibold text-secondary transition hover:bg-surface-sunken"
              >
                Cancel
              </button>
            </div>
          )}
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          {c.status === "active" && !confirming && (
            <p className="mt-2 text-xs text-muted">Closed campaigns stop showing on the reviewer dashboard immediately.</p>
          )}
        </div>
      )}
    </div>
  );
}
