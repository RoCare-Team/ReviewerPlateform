"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Inbox, Megaphone } from "lucide-react";
import CampaignRewardControl from "./CampaignRewardControl";
import CampaignStatusControl from "./CampaignStatusControl";
import DeleteCampaignButton from "./DeleteCampaignButton";
import SearchInput from "./SearchInput";

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
 * needs interactivity — everything else here is static. Search is separate
 * from the status tabs above the table on purpose: the tabs re-query the
 * server (they're links, and survive a reload), while search filters what's
 * already on screen — same split as admin/UsersTable.jsx.
 */
export default function AdminCampaignsTable({ campaigns, globalReward }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return campaigns;
    return campaigns.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.ownerName.toLowerCase().includes(q) ||
        (c.ownerPhone ?? "").toLowerCase().includes(q) ||
        (c.cities ?? []).some((city) => city.toLowerCase().includes(q)) ||
        (PLATFORM_LABEL[c.platform] ?? c.platform).toLowerCase().includes(q)
    );
  }, [campaigns, query]);

  return (
    <>
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search by campaign name, owner, city, or platform"
        resultLabel={query ? `${filtered.length} of ${campaigns.length} campaigns` : `${campaigns.length} shown`}
      />

      {filtered.length === 0 && (
        <div className="mt-6 rounded-card border border-dashed border-default bg-surface-raised p-10 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-sunken">
            <Inbox className="h-6 w-6 text-muted" aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm font-semibold text-primary">No campaigns match &quot;{query}&quot;</p>
          <p className="mt-1 text-sm text-secondary">Try a different spelling — search covers the current status tab only.</p>
        </div>
      )}

      {filtered.length > 0 && (
      <>
      {/* Desktop table */}
      <div className="mt-6 hidden overflow-x-auto rounded-card border border-default bg-surface-raised shadow-sm lg:block">
        <table className="w-full text-sm">
          <thead className="border-b border-default bg-surface-sunken text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3 font-semibold">Campaign</th>
              <th className="px-5 py-3 font-semibold">Owner</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Budget</th>
              <th className="px-5 py-3 font-semibold">Rate</th>
              <th className="px-5 py-3 font-semibold">Reviewer reward</th>
              <th className="px-5 py-3 font-semibold">Progress</th>
              <th className="px-5 py-3 font-semibold">Created</th>
              <th className="px-5 py-3 font-semibold">Link</th>
              <th className="px-5 py-3 font-semibold">Delete</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-default">
            {filtered.map((c) => (
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
                      {c.businessName && (
                        <p className="truncate text-xs font-medium text-secondary" title={c.businessCategory}>
                          {c.businessName}
                          {c.businessCategory && <span className="font-normal text-muted"> · {c.businessCategory}</span>}
                        </p>
                      )}
                      <p className="truncate text-xs text-muted" title={c.cities?.join(", ")}>
                        {PLATFORM_LABEL[c.platform] ?? c.platform}
                        {c.cities?.length > 0 && (
                          <> · <span className="font-medium text-secondary">{c.cities.length === 1 ? c.cities[0] : `${c.cities[0]} +${c.cities.length - 1} more`}</span></>
                        )}
                      </p>
                      {c.notes && <p className="mt-1 truncate text-xs text-secondary" title={c.notes}>{c.notes}</p>}
                    </div>
                  </div>
                </td>

                <td className="max-w-40 px-5 py-4">
                  <p className="truncate font-medium text-primary">{c.ownerName}</p>
                  {c.ownerEmail && <p className="truncate text-xs text-muted">{c.ownerEmail}</p>}
                  {c.ownerPhone && <p className="nums truncate text-xs text-muted">{c.ownerPhone}</p>}
                </td>

                <td className="px-5 py-4">
                  <CampaignStatusControl campaignId={c.id} status={c.status} />
                </td>

                <td className="nums px-5 py-4 font-semibold text-primary">{inr(c.budget)}</td>
                <td className="nums px-5 py-4 text-secondary">{inr(c.ratePerReview)}</td>

                <td className="px-5 py-4">
                  <CampaignRewardControl campaignId={c.id} override={c.reviewerReward} globalReward={globalReward} />
                </td>

                <td className="px-5 py-4">
                  <ProgressBar collected={c.collected} target={c.targetReviews} status={c.status} />
                </td>

                <td className="whitespace-nowrap px-5 py-4 text-secondary">
                  <p>{c.date}</p>
                  <p className="text-xs text-muted">{c.time}</p>
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

                <td className="px-5 py-4">
                  <DeleteCampaignButton
                    campaignId={c.id}
                    campaignName={c.name}
                    budget={c.budget}
                    collected={c.collected}
                    ratePerReview={c.ratePerReview}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:hidden">
        {filtered.map((c) => (
          <div
            key={c.id}
            className="rounded-card border border-default bg-surface-raised p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-md"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-base font-bold text-primary">{c.name}</h3>
                  <CampaignStatusControl campaignId={c.id} status={c.status} />
                  {c.pending > 0 && (
                    <span className="inline-flex shrink-0 rounded-full bg-pending-subtle px-2.5 py-0.5 text-xs font-semibold text-pending">
                      {c.pending} pending
                    </span>
                  )}
                </div>
                {c.businessName && (
                  <p className="mt-0.5 truncate text-xs font-medium text-secondary">
                    {c.businessName}
                    {c.businessCategory && <span className="font-normal text-muted"> · {c.businessCategory}</span>}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted" title={c.cities?.join(", ")}>
                  {PLATFORM_LABEL[c.platform] ?? c.platform} · by {c.ownerName}
                  {c.cities?.length > 0 && (
                    <> · <span className="font-medium text-secondary">{c.cities.length === 1 ? c.cities[0] : `${c.cities[0]} +${c.cities.length - 1} more`}</span></>
                  )}
                </p>
                {c.ownerEmail && <p className="truncate text-xs text-muted">{c.ownerEmail}</p>}
                {c.ownerPhone && <p className="nums truncate text-xs text-muted">{c.ownerPhone}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
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
                <DeleteCampaignButton
                  campaignId={c.id}
                  campaignName={c.name}
                  budget={c.budget}
                  collected={c.collected}
                  ratePerReview={c.ratePerReview}
                />
              </div>
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
              <div className="col-span-2 rounded-btn border border-default bg-surface p-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Created</dt>
                <dd className="mt-0.5 text-sm font-semibold text-primary">
                  {c.date} <span className="font-normal text-muted">at {c.time}</span>
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
      )}
    </>
  );
}
