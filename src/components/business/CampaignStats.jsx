"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
  FileCheck2,
  IndianRupee,
  MapPin,
  Megaphone,
  MessageSquare,
  Plus,
  Target,
  Wallet,
  XCircle,
} from "lucide-react";
import DonutChart from "../charts/DonutChart";
import StatCard from "../shared/StatCard";

/**
 * Overview stats, scoped by campaign. "All campaigns" is the default; clicking a
 * campaign chip swaps the tiles to that campaign's own numbers.
 *
 * Every figure is computed on the server and passed in already serialized —
 * this component owns the SELECTION only, never the arithmetic. That keeps the
 * money numbers (budget, reward paid) coming from one place, the DB, instead of
 * being re-derived in the browser where they could drift.
 */

const STATUS_STYLES = {
  active: "pill-verified",
  paused: "pill-pending",
  draft: "pill-accent",
  completed: "pill-accent",
};

// Icon + tone per stat key, kept out of the server payload — passing component
// references across the server→client boundary isn't possible, so the server
// sends plain keys and the mapping lives here.
const TILE = {
  activeCampaigns: { Icon: Megaphone, tone: "text-accent", href: "/business/campaigns" },
  reviewsFetched: { Icon: MessageSquare, tone: "text-accent", href: "/business/reviews" },
  target: { Icon: Target, tone: "text-verified", href: "/business/campaigns" },
  locations: { Icon: MapPin, tone: "text-accent", href: "/business/connections" },
  spend: { Icon: IndianRupee, tone: "text-accent", href: "/business/campaigns" },
  wallet: { Icon: Wallet, tone: "text-accent", href: "/business/settings" },
  collected: { Icon: CheckCircle2, tone: "text-verified", href: "/business/campaigns" },
  pending: { Icon: Clock, tone: "text-pending", href: "/business/feedback" },
  rejected: { Icon: XCircle, tone: "text-danger", href: "/business/feedback" },
  budgetUsed: { Icon: Coins, tone: "text-accent", href: "/business/campaigns" },
};

function StatGrid({ stats }) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:gap-4">
      {stats.map(({ key, label, value, hint }) => {
        const { Icon, tone, href } = TILE[key] ?? TILE.target;
        return <StatCard key={key} label={label} value={value} Icon={Icon} tone={tone} href={href} sub={hint} />;
      })}
    </div>
  );
}

function ChartsRow({ approved, pending, rejected, budget, budgetUsed }) {
  const hasSubs = (approved ?? 0) + (pending ?? 0) + (rejected ?? 0) > 0;
  const hasBudget = (budget ?? 0) > 0;

  // Used to render nothing at all here — a 0/0 donut is meaningless, but a
  // silently blank stretch of page reads as broken, not "nothing to show
  // yet". An explicit empty state at least explains why.
  if (!hasSubs && !hasBudget) {
    return (
      <div className="mt-5 rounded-card border border-dashed border-default bg-surface-raised p-8 text-center">
        <FileCheck2 className="mx-auto h-6 w-6 text-muted" aria-hidden="true" />
        <p className="mt-2 text-sm font-semibold text-primary">No activity yet</p>
        <p className="mt-1 text-sm text-secondary">
          Charts show up here once a campaign has spent budget or collected a submission.
        </p>
        <Link
          href="/business/campaigns"
          className="mt-4 inline-flex items-center gap-1.5 rounded-btn bg-accent px-4 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-md"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create campaign
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      {hasSubs && (
        <div className="rounded-card border border-default bg-surface-raised p-6 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-bold text-primary">
            <FileCheck2 className="h-4 w-4 text-accent" aria-hidden="true" />
            Submission status
          </h3>
          <div className="mt-5">
            <DonutChart
              centerLabel="submissions"
              segments={[
                { label: "Approved", value: approved, color: "var(--verified)" },
                { label: "Pending", value: pending, color: "var(--pending)" },
                { label: "Rejected", value: rejected, color: "var(--danger)" },
              ]}
            />
          </div>
        </div>
      )}

      {hasBudget && (
        <div className="rounded-card border border-default bg-surface-raised p-6 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-bold text-primary">
            <IndianRupee className="h-4 w-4 text-accent" aria-hidden="true" />
            Budget usage
          </h3>
          <div className="mt-5">
            <DonutChart
              centerLabel="₹ total"
              segments={[
                { label: "Used", value: Math.round(budgetUsed ?? 0), color: "var(--accent)" },
                { label: "Remaining", value: Math.max(0, Math.round(budget - (budgetUsed ?? 0))), color: "var(--border-strong)" },
              ]}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Progress({ collected, target }) {
  if (!target) return null;
  const pct = Math.min(100, Math.round((collected / target) * 100));

  return (
    <div className="mt-5 rounded-card border border-default bg-surface-raised p-5 shadow-sm">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-primary">Verified review progress</span>
        <span className="nums font-semibold text-accent">{pct}%</span>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-surface-sunken"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Verified review progress"
      >
        <div
          className="h-full rounded-full bg-accent transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="nums mt-2 text-xs text-muted">
        {collected} of {target} verified reviews collected
      </p>
    </div>
  );
}

export default function CampaignStats({ overall, campaigns }) {
  // null = "All campaigns". Storing the id (not the object) keeps the selection
  // valid if the parent re-renders with refreshed campaign data.
  const [selectedId, setSelectedId] = useState(null);
  const chipsRef = useRef(null);

  const selected = campaigns.find((c) => c.id === selectedId) ?? null;
  const view = selected ?? overall;

  const scrollChips = (direction) => {
    chipsRef.current?.scrollBy({ left: direction * 200, behavior: "smooth" });
  };

  return (
    <section aria-label="Overview statistics">
      {campaigns.length > 0 && (
        <div className="rounded-card border border-default bg-surface-raised p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-secondary">Showing stats for</h2>
            {selected ? (
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                  STATUS_STYLES[selected.status] ?? "pill-accent"
                }`}
              >
                {selected.status}
              </span>
            ) : null}
          </div>

          {/* Chip row doubles as the filter control. Scrolls sideways rather
              than wrapping into a tall block when there are many campaigns.
              The native scrollbar is hidden; the arrow buttons drive scrolling
              instead so the control reads as a carousel, not a webpage scrollbar. */}
          <div className="mt-3 flex items-center gap-1">
            <button
              type="button"
              onClick={() => scrollChips(-1)}
              aria-label="Scroll campaigns left"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-default bg-surface text-secondary transition-colors hover:border-accent/40 hover:text-primary"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>

            <div
              ref={chipsRef}
              role="tablist"
              aria-label="Filter stats by campaign"
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
              aria-label="Scroll campaigns right"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-default bg-surface text-secondary transition-colors hover:border-accent/40 hover:text-primary"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {selected ? (
        <p className="mt-3 text-sm text-secondary">
          {selected.platformLabel}
          {selected.locationTitle ? ` · ${selected.locationTitle}` : ""} · budget{" "}
          {selected.budgetDisplay} at {selected.rateDisplay} per verified review
        </p>
      ) : null}

      {/* `key` forces a fresh mount per selection so the tiles re-run their
          enter transition — without it the numbers swap with no visible change
          and the click feels like it did nothing. */}
      <StatGrid key={view.id ?? "all"} stats={view.stats} />

      <ChartsRow
        key={`charts-${view.id ?? "all"}`}
        approved={view.approved}
        pending={view.pending}
        rejected={view.rejected}
        budget={view.budget}
        budgetUsed={view.budgetUsed}
      />

      <Progress collected={view.collected} target={view.target} />
    </section>
  );
}
