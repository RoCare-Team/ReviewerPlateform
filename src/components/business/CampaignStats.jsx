"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Clock,
  Coins,
  IndianRupee,
  MapPin,
  Megaphone,
  MessageSquare,
  Target,
  Wallet,
  XCircle,
} from "lucide-react";

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
  activeCampaigns: { Icon: Megaphone, tone: "text-accent" },
  reviewsFetched: { Icon: MessageSquare, tone: "text-accent" },
  target: { Icon: Target, tone: "text-verified" },
  locations: { Icon: MapPin, tone: "text-accent" },
  spend: { Icon: IndianRupee, tone: "text-accent" },
  wallet: { Icon: Wallet, tone: "text-accent" },
  collected: { Icon: CheckCircle2, tone: "text-verified" },
  pending: { Icon: Clock, tone: "text-pending" },
  rejected: { Icon: XCircle, tone: "text-danger" },
  budgetUsed: { Icon: Coins, tone: "text-accent" },
};

function StatGrid({ stats }) {
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {stats.map(({ key, label, value, hint }, i) => {
        const { Icon, tone } = TILE[key] ?? TILE.target;
        return (
          <div
            key={key}
            style={{ animationDelay: `${i * 45}ms` }}
            className="animate-fade-up group rounded-card border border-default bg-surface-raised p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-secondary">{label}</span>
              <Icon
                className={`h-5 w-5 ${tone} transition-transform duration-300 group-hover:scale-110`}
                aria-hidden="true"
              />
            </div>
            <p className="nums mt-3 text-3xl font-extrabold tracking-tight text-primary">{value}</p>
            {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
          </div>
        );
      })}
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

  const selected = campaigns.find((c) => c.id === selectedId) ?? null;
  const view = selected ?? overall;

  return (
    <section aria-label="Overview statistics">
      {campaigns.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-primary">Showing stats for</h2>
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
              than wrapping into a tall block when there are many campaigns. */}
          <div
            role="tablist"
            aria-label="Filter stats by campaign"
            className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-2"
          >
            <button
              type="button"
              role="tab"
              aria-selected={selected === null}
              onClick={() => setSelectedId(null)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                selected === null
                  ? "border-transparent bg-accent text-on-brand shadow-sm"
                  : "border-default bg-surface text-secondary hover:border-accent/40 hover:text-primary"
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
                      : "border-default bg-surface text-secondary hover:border-accent/40 hover:text-primary"
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </>
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

      <Progress collected={view.collected} target={view.target} />
    </section>
  );
}
