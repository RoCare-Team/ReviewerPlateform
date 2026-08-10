"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Megaphone, Pause, Play } from "lucide-react";
import CampaignCard from "./CampaignCard";
import { toast } from "../../lib/toast";

const STATUS_STYLES = { active: "pill-verified", paused: "pill-pending", draft: "pill-accent", completed: "pill-accent" };
const PLATFORM_LABEL = { google: "Google", trustpilot: "Trustpilot", capterra: "Capterra", amazon: "Amazon", playstore: "Play Store" };

function inr(n) {
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

/**
 * Campaign list for /business/campaigns — a dense table on desktop (every
 * campaign's status, progress, and money in one scannable row instead of
 * hunting through a grid of cards), a card list on mobile where a table
 * would just force horizontal scrolling on every row. CampaignCard is reused
 * as-is for the mobile view, so both layouts share one close/reopen
 * implementation.
 */
export default function CampaignsTable({ campaigns }) {
  const router = useRouter();
  const [confirmingId, setConfirmingId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [rowError, setRowError] = useState({});

  async function toggle(c) {
    const action = c.status === "active" ? "pause" : "activate";
    setBusyId(c.id);
    setRowError((e) => ({ ...e, [c.id]: "" }));
    const res = await fetch(`/api/business/campaigns/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message = data.error ?? "Couldn't update the campaign.";
      setRowError((e) => ({ ...e, [c.id]: message }));
      toast.error(message);
      return;
    }
    toast.success(action === "pause" ? "Campaign closed." : "Campaign reopened.");
    setConfirmingId(null);
    router.refresh();
  }

  return (
    <>
      {/* Desktop table */}
      <div className="mt-8 hidden overflow-x-auto rounded-card border border-default bg-surface-raised shadow-sm lg:block">
        <table className="w-full text-sm">
          <thead className="border-b border-default bg-surface-sunken text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3 font-semibold">Campaign</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Progress</th>
              <th className="px-5 py-3 font-semibold">Budget</th>
              <th className="px-5 py-3 font-semibold">Rate</th>
              <th className="px-5 py-3 font-semibold">Target</th>
              <th className="px-5 py-3 font-semibold">Review link</th>
              <th className="px-5 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-default">
            {campaigns.map((c) => {
              const pct = c.targetReviews ? Math.min(100, Math.round((c.collected / c.targetReviews) * 100)) : 0;
              const canToggle = c.status === "active" || c.status === "paused";
              const confirming = confirmingId === c.id;
              const busy = busyId === c.id;

              return (
                <tr key={c.id} className="align-top transition-colors duration-150 hover:bg-surface-sunken/50">
                  <td className="max-w-64 px-5 py-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent">
                        <Megaphone className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-primary">{c.name}</p>
                        <p className="truncate text-xs text-muted">
                          {PLATFORM_LABEL[c.platform] ?? c.platform} ·{" "}
                          {c.createdAt
                            ? new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                            : ""}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[c.status]}`}>
                      {c.status}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <div className="w-32">
                      <div className="flex items-center justify-between text-xs font-medium text-secondary">
                        <span className="nums">{c.collected}/{c.targetReviews}</span>
                        <span className="nums font-bold text-primary">{pct}%</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ease-out ${c.status === "paused" ? "bg-pending" : "bg-accent"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  <td className="nums px-5 py-4 font-semibold text-primary">{inr(c.budget)}</td>
                  <td className="nums px-5 py-4 text-secondary">{inr(c.ratePerReview)}</td>
                  <td className="nums px-5 py-4 text-secondary">{c.targetReviews}</td>

                  <td className="px-5 py-4">
                    {c.targetUrl ? (
                      <a
                        href={c.targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={c.targetUrl}
                        aria-label="Open review link"
                        className="inline-flex items-center justify-center rounded-btn border border-default bg-surface p-2 text-accent transition-colors duration-150 hover:bg-accent-subtle"
                      >
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      </a>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>

                  <td className="px-5 py-4">
                    {!canToggle ? (
                      <span className="text-xs text-muted">—</span>
                    ) : confirming ? (
                      <div className="animate-fade-up flex flex-col gap-1.5" style={{ animationDuration: "200ms" }}>
                        <button
                          type="button"
                          onClick={() => toggle(c)}
                          disabled={busy}
                          className="rounded-btn bg-accent px-3 py-1.5 text-xs font-semibold text-on-brand shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60 disabled:hover:translate-y-0"
                        >
                          {busy ? "Working…" : "Confirm"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingId(null)}
                          disabled={busy}
                          className="rounded-btn border border-default bg-surface px-3 py-1.5 text-xs font-semibold text-secondary transition-colors duration-200 hover:bg-surface-sunken"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmingId(c.id)}
                        className={
                          c.status === "active"
                            ? "inline-flex items-center gap-1.5 rounded-btn border border-danger-subtle bg-danger-subtle px-3 py-1.5 text-xs font-semibold text-danger transition-all duration-200 hover:-translate-y-0.5 hover:bg-danger/10"
                            : "inline-flex items-center gap-1.5 rounded-btn border border-strong bg-surface px-3 py-1.5 text-xs font-semibold text-primary transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface-sunken"
                        }
                      >
                        {c.status === "active" ? (
                          <>
                            <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                            Close
                          </>
                        ) : (
                          <>
                            <Play className="h-3.5 w-3.5" aria-hidden="true" />
                            Reopen
                          </>
                        )}
                      </button>
                    )}
                    {rowError[c.id] && <p className="mt-1.5 max-w-40 text-xs text-danger">{rowError[c.id]}</p>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards — a table would just force horizontal scroll per row here.
          `grid-cols-1` is load-bearing, not decorative: without an explicit
          track, a bare `grid` container sizes its single column to `auto`
          (fit-content), and grid items get an implicit `min-width: auto` —
          so a campaign with a long, unbroken review URL (no spaces to wrap
          on) blows the column, the grid, and the whole page wider than the
          viewport. `truncate` on that URL never gets a chance to kick in
          because nothing upstream is actually constraining the width. */}
      <div className="mt-8 grid grid-cols-1 gap-5 lg:hidden">
        {campaigns.map((c) => (
          <CampaignCard key={c.id} campaign={c} />
        ))}
      </div>
    </>
  );
}
