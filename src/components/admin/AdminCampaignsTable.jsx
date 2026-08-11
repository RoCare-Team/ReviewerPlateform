"use client";

import { ExternalLink, Megaphone } from "lucide-react";
import CampaignRewardControl from "./CampaignRewardControl";

const STATUS_STYLE = { active: "pill-verified", completed: "pill-accent", paused: "pill-pending", draft: "pill-pending" };
const PLATFORM_LABEL = { google: "Google", trustpilot: "Trustpilot", capterra: "Capterra", amazon: "Amazon", playstore: "Play Store" };

function inr(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

function ProgressBar({ collected, target, status, className = "w-28" }) {
  const pct = target ? Math.min(100, Math.round((collected / target) * 100)) : 0;
  const tone = status === "paused" || status === "draft" ? "bg-pending" : "bg-accent";
  return (
    <div className={className}>
      <div className="flex items-center justify-between text-xs font-medium text-secondary">
        <span className="nums">{collected}/{target}</span>
        <span className="nums font-bold text-primary">{pct}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
        <div className={`h-full rounded-full ${tone} transition-all duration-700 ease-out`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/**
 * Admin campaigns list — a dense table on desktop (every campaign's owner,
 * money, and progress in one scannable row), a card list on mobile where a
 * table would just force horizontal scrolling. Same desktop-table /
 * mobile-card split as business/CampaignsTable.jsx and admin/UsersTable.jsx.
 *
 * Client component (not the page itself) only because CampaignRewardControl
 * needs interactivity — everything else here is static.
 */
export default function AdminCampaignsTable({ campaigns, globalReward }) {
  return (
    <>
      {/* Desktop table */}
      <div className="mt-6 hidden overflow-x-auto rounded-card border border-default bg-surface-raised shadow-sm lg:block">
        <table className="w-full text-sm">
          <thead className="border-b border-default bg-surface-sunken text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3 font-semibold">Campaign</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Budget</th>
              <th className="px-5 py-3 font-semibold">Rate</th>
              <th className="px-5 py-3 font-semibold">Reviewer reward</th>
              <th className="px-5 py-3 font-semibold">Progress</th>
              <th className="px-5 py-3 font-semibold">Link</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-default">
            {campaigns.map((c) => (
              <tr key={c.id} className="align-top transition-colors duration-150 hover:bg-surface-sunken/50">
                <td className="max-w-72 px-5 py-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent">
                      <Megaphone className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate font-semibold text-primary">{c.name}</p>
                        {c.pending > 0 && (
                          <span className="inline-flex shrink-0 rounded-full bg-pending-subtle px-1.5 py-0.5 text-[10px] font-bold text-pending">
                            {c.pending} pending
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted">
                        {PLATFORM_LABEL[c.platform] ?? c.platform} · {c.ownerName} · {c.date}
                      </p>
                      {c.notes && <p className="mt-1 truncate text-xs text-secondary" title={c.notes}>{c.notes}</p>}
                    </div>
                  </div>
                </td>

                <td className="px-5 py-4">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLE[c.status]}`}>
                    {c.status}
                  </span>
                </td>

                <td className="nums px-5 py-4 font-semibold text-primary">{inr(c.budget)}</td>
                <td className="nums px-5 py-4 text-secondary">{inr(c.ratePerReview)}</td>

                <td className="px-5 py-4">
                  <CampaignRewardControl campaignId={c.id} override={c.reviewerReward} globalReward={globalReward} />
                </td>

                <td className="px-5 py-4">
                  <ProgressBar collected={c.collected} target={c.targetReviews} status={c.status} />
                </td>

                <td className="px-5 py-4">
                  {c.targetUrl ? (
                    <a
                      href={c.targetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open review link"
                      aria-label="Open review link"
                      className="inline-flex items-center justify-center rounded-btn border border-default bg-surface p-2 text-accent transition-colors duration-150 hover:bg-accent-subtle"
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </a>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:hidden">
        {campaigns.map((c) => (
          <div
            key={c.id}
            className="rounded-card border border-default bg-surface-raised p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-md"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-base font-bold text-primary">{c.name}</h3>
                  <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLE[c.status]}`}>
                    {c.status}
                  </span>
                  {c.pending > 0 && (
                    <span className="inline-flex shrink-0 rounded-full bg-pending-subtle px-2.5 py-0.5 text-xs font-semibold text-pending">
                      {c.pending} pending
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted">
                  {PLATFORM_LABEL[c.platform] ?? c.platform} · by {c.ownerName} · {c.date}
                </p>
              </div>
              {c.targetUrl && (
                <a
                  href={c.targetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-40 shrink-0 items-center gap-1 truncate text-xs font-semibold text-accent transition-colors duration-150 hover:underline"
                >
                  Review link <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                </a>
              )}
            </div>

            {c.notes && <p className="mt-3 text-sm text-secondary">{c.notes}</p>}

            <dl className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-btn border border-default bg-surface p-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Budget</dt>
                <dd className="nums mt-0.5 text-base font-bold text-primary">{inr(c.budget)}</dd>
              </div>
              <div className="rounded-btn border border-default bg-surface p-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Rate</dt>
                <dd className="nums mt-0.5 text-base font-bold text-primary">{inr(c.ratePerReview)}</dd>
              </div>
              <div className="col-span-2 rounded-btn border border-default bg-surface p-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Reviewer reward</dt>
                <dd className="mt-0.5">
                  <CampaignRewardControl campaignId={c.id} override={c.reviewerReward} globalReward={globalReward} />
                </dd>
              </div>
            </dl>

            <div className="mt-3">
              <ProgressBar collected={c.collected} target={c.targetReviews} status={c.status} className="w-full" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
