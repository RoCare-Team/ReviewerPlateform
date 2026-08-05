"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  IndianRupee,
  Link2,
  Megaphone,
  Pause,
  Play,
  Target,
} from "lucide-react";

const STATUS_STYLES = { active: "pill-verified", paused: "pill-pending", draft: "pill-accent", completed: "pill-accent" };
const PLATFORM_LABEL = { google: "Google", trustpilot: "Trustpilot", capterra: "Capterra", amazon: "Amazon", playstore: "Play Store" };

function inr(n) {
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

function Stat({ Icon, label, value }) {
  return (
    <div className="flex items-center gap-2.5 rounded-btn border border-default bg-surface p-3 transition-colors duration-200 hover:bg-surface-sunken">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</p>
        <p className="nums truncate text-sm font-bold text-primary">{value}</p>
      </div>
    </div>
  );
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
    <div className="group flex h-full flex-col rounded-card border border-default bg-surface-raised p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-accent/30 hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-subtle text-accent transition-transform duration-300 group-hover:scale-110">
            <Megaphone className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold text-primary">{c.name}</h3>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-medium text-muted">
              <span>{PLATFORM_LABEL[c.platform] ?? c.platform}</span>
              {c.createdAt && (
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden="true">·</span>
                  <CalendarDays className="h-3 w-3" aria-hidden="true" />
                  {new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              )}
            </p>
          </div>
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
          className="mt-3 inline-flex max-w-full items-center gap-1.5 truncate text-sm font-semibold text-accent transition-colors duration-150 hover:underline"
          title={c.targetUrl}
        >
          <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{c.targetUrl}</span>
        </a>
      )}

      <div className="mt-5">
        <div className="flex items-center justify-between text-xs font-medium text-secondary">
          <span className="nums">{c.collected} / {c.targetReviews} verified reviews</span>
          <span className="nums font-bold text-primary">{pct}%</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-sunken">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${c.status === "paused" ? "bg-pending" : "bg-accent"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2.5">
        <Stat Icon={IndianRupee} label="Budget" value={inr(c.budget)} />
        <Stat Icon={CheckCircle2} label="Rate" value={inr(c.ratePerReview)} />
        <Stat Icon={Target} label="Target" value={c.targetReviews} />
      </div>

      {canToggle && (
        <div className="mt-5 border-t border-default pt-4">
          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className={
                c.status === "active"
                  ? "inline-flex items-center gap-2 rounded-btn border border-danger-subtle bg-danger-subtle px-3.5 py-2 text-sm font-semibold text-danger transition-all duration-200 hover:-translate-y-0.5 hover:bg-danger/10 hover:shadow-sm"
                  : "inline-flex items-center gap-2 rounded-btn border border-strong bg-surface px-3.5 py-2 text-sm font-semibold text-primary transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface-sunken hover:shadow-sm"
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
            <div className="animate-fade-up flex flex-wrap items-center gap-2" style={{ animationDuration: "200ms" }}>
              <span className="text-sm text-secondary">
                {c.status === "active"
                  ? "Stop collecting reviews for this campaign?"
                  : "Start collecting reviews again?"}
              </span>
              <button
                type="button"
                onClick={toggle}
                disabled={pending}
                className="rounded-btn bg-accent px-3.5 py-2 text-sm font-semibold text-on-brand shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-md disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {pending ? "Working…" : "Yes, confirm"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={pending}
                className="rounded-btn border border-default bg-surface px-3.5 py-2 text-sm font-semibold text-secondary transition-colors duration-200 hover:bg-surface-sunken"
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
