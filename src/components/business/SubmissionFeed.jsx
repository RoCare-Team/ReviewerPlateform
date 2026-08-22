"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Inbox,
  MessageSquare,
  XCircle,
} from "lucide-react";

const STATUS_STYLES = {
  approved: "pill-verified",
  pending: "pill-pending",
  rejected: "pill-danger",
};

const CAMPAIGN_STATUS_STYLES = {
  active: "pill-verified",
  paused: "pill-pending",
  draft: "pill-accent",
  completed: "pill-accent",
};

function SummaryTile({ label, value, Icon, tone }) {
  return (
    <div className="rounded-card border border-default bg-surface-raised p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-sm text-secondary">{label}</p>
        <Icon className={`h-5 w-5 ${tone}`} aria-hidden="true" />
      </div>
      <p className="nums mt-3 text-3xl font-bold tracking-tight text-primary">{value}</p>
    </div>
  );
}

function SubmissionRow({ s }) {
  return (
    <li className="rounded-btn border border-default bg-surface p-4 transition-colors duration-200 hover:border-strong">
      <div className="flex flex-wrap items-start gap-4">
        <a
          href={s.screenshotUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group/shot relative shrink-0 rounded-btn focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Image
            src={s.screenshotUrl}
            alt={`Review proof from ${s.reviewerName || "reviewer"}`}
            width={80}
            height={80}
            className="h-20 w-20 rounded-btn border border-default object-cover transition-opacity duration-200 group-hover/shot:opacity-80"
            unoptimized
          />
          <ExternalLink
            className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded bg-surface/90 text-muted opacity-0 transition-opacity duration-200 group-hover/shot:opacity-100"
            aria-hidden="true"
          />
        </a>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-primary">{s.reviewerName || "Reviewer"}</p>
              <p className="text-xs text-muted">
                Submitted {new Date(s.createdAt).toLocaleDateString("en-IN")}
                {s.reviewedAt ? ` · reviewed ${new Date(s.reviewedAt).toLocaleDateString("en-IN")}` : ""}
              </p>
            </div>
            <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[s.status]}`}>
              {s.status}
            </span>
          </div>

          {s.note && <p className="mt-2 text-sm leading-relaxed text-secondary">{s.note}</p>}

          {s.status === "rejected" && s.rejectionReason && (
            <p className="mt-2 text-xs text-danger">Rejected: {s.rejectionReason}</p>
          )}

          {s.status === "approved" && (
            <p className="nums mt-2 text-xs font-semibold text-verified">
              Verified — counted towards this campaign
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * Campaign-scoped submissions. A tab row ("All campaigns" + one tab per
 * campaign) picks the scope — click a campaign's tab and only ITS submitted
 * reviews load below, instead of every campaign's proof list open on one
 * long page.
 */
export default function SubmissionFeed({ campaigns }) {
  const [selectedId, setSelectedId] = useState(null);
  const chipsRef = useRef(null);
  // Tracks whether there's more to scroll to on each side, so the arrow
  // buttons can fade out / disable at the ends instead of always looking
  // equally clickable regardless of scroll position.
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = () => {
    const el = chipsRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateScrollState();
    const el = chipsRef.current;
    if (!el) return undefined;
    const onResize = () => updateScrollState();
    el.addEventListener("scroll", updateScrollState);
    window.addEventListener("resize", onResize);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", onResize);
    };
  }, [campaigns.length]);

  const scrollChips = (direction) => {
    chipsRef.current?.scrollBy({ left: direction * 200, behavior: "smooth" });
  };

  const selected = campaigns.find((c) => c.id === selectedId) ?? null;
  const scopeList = selected ? [selected] : campaigns;
  const allSubs = scopeList.flatMap((c) => c.subs);

  const total = allSubs.length;
  const approved = allSubs.filter((s) => s.status === "approved").length;
  const pending = allSubs.filter((s) => s.status === "pending").length;
  const rejected = allSubs.filter((s) => s.status === "rejected").length;

  return (
    <div>
      {campaigns.length > 0 && (
        <div className="mt-1 rounded-card border border-default bg-surface-raised p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-secondary">Showing submissions for</h2>

          {/* Chip row doubles as the filter control. Native scrollbar hidden;
              the arrow buttons drive scrolling so it reads as a carousel. */}
          <div className="mt-3 flex items-center gap-1">
            <button
              type="button"
              onClick={() => scrollChips(-1)}
              disabled={!canScrollLeft}
              aria-label="Scroll campaigns left"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-default bg-surface text-secondary transition-all duration-200 hover:border-accent/40 hover:text-primary disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>

            <div
              ref={chipsRef}
              role="tablist"
              aria-label="Filter submissions by campaign"
              className="scrollbar-none flex flex-1 gap-2 overflow-x-auto scroll-smooth px-1 pb-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={selected === null}
                onClick={() => setSelectedId(null)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  selected === null
                    ? "border-transparent bg-accent text-on-brand shadow-sm"
                    : "border-default bg-surface text-secondary hover:-translate-y-0.5 hover:border-accent/40 hover:text-primary"
                }`}
              >
                All campaigns
              </button>
              {campaigns.map((c) => {
                const isActive = c.id === selectedId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setSelectedId(c.id)}
                    className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                      isActive
                        ? "border-transparent bg-accent text-on-brand shadow-sm"
                        : "border-default bg-surface text-secondary hover:-translate-y-0.5 hover:border-accent/40 hover:text-primary"
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => scrollChips(1)}
              disabled={!canScrollRight}
              aria-label="Scroll campaigns right"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-default bg-surface text-secondary transition-all duration-200 hover:border-accent/40 hover:text-primary disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Summary — scoped to the selected campaign, or account-wide on "All" */}
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryTile label="Submissions" value={String(total)} Icon={MessageSquare} tone="text-accent" />
        <SummaryTile label="Verified" value={String(approved)} Icon={CheckCircle2} tone="text-verified" />
        <SummaryTile label="Awaiting verification" value={String(pending)} Icon={Clock} tone="text-pending" />
        <SummaryTile label="Rejected" value={String(rejected)} Icon={XCircle} tone="text-danger" />
      </div>

      {campaigns.length === 0 ? (
        <div className="mt-8 rounded-card border border-dashed border-default bg-surface-raised p-10 text-center">
          <Inbox className="mx-auto h-8 w-8 text-muted" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-primary">No campaigns yet</p>
          <p className="mt-1 text-sm text-secondary">
            Reviewer submissions show up here once you create a campaign.
          </p>
        </div>
      ) : !selected ? (
        // All campaigns — a compact grid, click a card to jump to its tab.
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => {
            const pct = c.targetReviews ? Math.min(100, Math.round((c.collected / c.targetReviews) * 100)) : 0;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className="group rounded-card border border-default bg-surface-raised p-5 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="truncate text-base font-bold text-primary">{c.name}</h3>
                  <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${CAMPAIGN_STATUS_STYLES[c.status] ?? "pill-accent"}`}>
                    {c.status}
                  </span>
                </div>
                <p className="nums mt-1 text-xs text-muted">
                  {c.platformLabel} · {c.subs.length} submission{c.subs.length === 1 ? "" : "s"} · {c.collected}/{c.targetReviews} verified
                </p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-sunken">
                  <div className="h-full rounded-full bg-accent transition-all duration-700 ease-out" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-3 text-xs font-semibold text-accent transition-transform duration-200 group-hover:translate-x-0.5">
                  View submissions →
                </p>
              </button>
            );
          })}
        </div>
      ) : (
        // One campaign, scoped — only its submitted reviews.
        <div className="mt-6">
          <div className="rounded-card border border-default bg-surface-raised p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg font-bold text-primary">{selected.name}</h2>
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${CAMPAIGN_STATUS_STYLES[selected.status] ?? "pill-accent"}`}>
                {selected.status}
              </span>
            </div>
            <p className="nums mt-1 text-xs text-muted">
              {selected.platformLabel} · {selected.collected}/{selected.targetReviews} verified
            </p>
          </div>

          <div className="mt-4">
            {selected.subs.length === 0 ? (
              <p className="rounded-card border border-dashed border-default bg-surface-raised p-8 text-center text-sm text-secondary">
                No submissions for this campaign yet. Reviewers who join will appear here with their proof.
              </p>
            ) : (
              <ul className="space-y-3">
                {selected.subs.map((s) => (
                  <SubmissionRow key={s.id} s={s} />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

     
    </div>
  );
}
