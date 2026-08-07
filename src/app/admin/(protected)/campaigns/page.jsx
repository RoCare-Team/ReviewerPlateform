import {
  Megaphone,
  ExternalLink,
  IndianRupee,
  Tag,
  Target,
  CheckCircle2,
  BarChart3,
  Inbox,
} from "lucide-react";
import { requireAdmin } from "../../../../lib/auth/guards";
import dbConnect from "../../../../lib/db";
import Campaign from "../../../../models/Campaign";
import User from "../../../../models/User";
import Submission from "../../../../models/Submission";
import { inr } from "../../../../lib/settings";

export const metadata = { title: "Campaigns · Admin", robots: { index: false } };

const STATUS_STYLE = { active: "pill-verified", completed: "pill-accent", paused: "pill-pending", draft: "pill-pending" };
const PLATFORM_LABEL = { google: "Google", trustpilot: "Trustpilot", capterra: "Capterra", amazon: "Amazon", playstore: "Play Store" };

export default async function AdminCampaignsPage({ searchParams }) {
  await requireAdmin();
  const params = await searchParams;
  const statusFilter = params?.status;

  await dbConnect();
  const query = ["active", "completed", "paused", "draft"].includes(statusFilter) ? { status: statusFilter } : {};
  const campaigns = await Campaign.find(query).sort({ createdAt: -1 }).limit(500).lean();

  // Per-status counts, independent of the current filter — so the tabs can
  // show a count badge without the number changing to match whichever tab
  // happens to be selected.
  const statusAgg = await Campaign.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]);
  const statusCounts = Object.fromEntries(statusAgg.map((s) => [s._id, s.n]));
  const totalCampaigns = statusAgg.reduce((s, r) => s + r.n, 0);

  const ownerIds = [...new Set(campaigns.map((c) => String(c.user)))];
  const owners = await User.find({ _id: { $in: ownerIds } }).select("name email").lean();
  const oMap = new Map(owners.map((o) => [String(o._id), o]));

  // Pending submissions per campaign (so admin sees what needs verifying).
  const pendingAgg = await Submission.aggregate([
    { $match: { status: "pending" } },
    { $group: { _id: "$campaign", n: { $sum: 1 } } },
  ]);
  const pendingMap = new Map(pendingAgg.map((p) => [String(p._id), p.n]));

  const totals = campaigns.reduce(
    (t, c) => {
      t.budget += c.budget ?? 0;
      t.collected += c.collected ?? 0;
      t.target += c.targetReviews ?? 0;
      return t;
    },
    { budget: 0, collected: 0, target: 0 }
  );

  const tabs = [
    { key: "", label: "All", count: totalCampaigns },
    { key: "active", label: "Active", count: statusCounts.active ?? 0 },
    { key: "completed", label: "Completed", count: statusCounts.completed ?? 0 },
    { key: "paused", label: "Paused", count: statusCounts.paused ?? 0 },
    { key: "draft", label: "Draft", count: statusCounts.draft ?? 0 },
  ];

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-subtle text-accent">
          <Megaphone className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Campaigns</h1>
          <p className="text-sm text-secondary">
            {campaigns.length} shown · {inr(totals.budget)} budget · {totals.collected}/{totals.target} reviews collected
          </p>
        </div>
      </div>

      {/* Status filter */}
      <div className="-mx-1 mt-6 flex gap-2 overflow-x-auto px-1 pb-1">
        {tabs.map((t) => {
          const active = (statusFilter ?? "") === t.key;
          return (
            <a
              key={t.label}
              href={t.key ? `/admin/campaigns?status=${t.key}` : "/admin/campaigns"}
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                active
                  ? "border-transparent bg-accent text-on-brand shadow-sm"
                  : "border-default bg-surface text-secondary hover:-translate-y-0.5 hover:border-accent/40 hover:text-primary"
              }`}
            >
              {t.label}
              <span className={`nums rounded-full px-1.5 py-0.5 text-xs transition-colors duration-200 ${active ? "bg-white/20" : "bg-surface-sunken"}`}>
                {t.count}
              </span>
            </a>
          );
        })}
      </div>

      {campaigns.length === 0 ? (
        <div className="animate-fade-up mt-8 rounded-card border border-dashed border-default bg-surface-raised p-12 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-sunken">
            <Inbox className="h-6 w-6 text-muted" aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm font-semibold text-primary">No campaigns found</p>
          <p className="mt-1 text-sm text-secondary">Nothing matches this filter yet.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {campaigns.map((c, i) => {
            const owner = oMap.get(String(c.user));
            const pending = pendingMap.get(String(c._id)) ?? 0;
            const pct = c.targetReviews ? Math.min(100, Math.round((c.collected / c.targetReviews) * 100)) : 0;
            const barTone = c.status === "paused" || c.status === "draft" ? "bg-pending" : "bg-accent";
            return (
              <div
                key={String(c._id)}
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                className="animate-fade-up rounded-card border border-default bg-surface-raised p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-md"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-primary">{c.name}</h3>
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLE[c.status]}`}>
                        {c.status}
                      </span>
                      {pending > 0 && (
                        <span className="inline-flex rounded-full bg-pending-subtle px-2.5 py-0.5 text-xs font-semibold text-pending">
                          {pending} pending
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {PLATFORM_LABEL[c.platform] ?? c.platform} · by {owner?.name || owner?.email || "Unknown"} ·{" "}
                      {new Date(c.createdAt).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                  {c.targetUrl && (
                    <a href={c.targetUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex max-w-[16rem] shrink-0 items-center gap-1 truncate text-xs font-semibold text-accent transition-colors duration-150 hover:underline">
                      Review link <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    </a>
                  )}
                </div>

                {c.notes && <p className="mt-3 text-sm text-secondary">{c.notes}</p>}

                {/* Figures */}
                <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <Fig label="Budget" value={inr(c.budget)} Icon={IndianRupee} />
                  <Fig label="Rate" value={inr(c.ratePerReview)} Icon={Tag} />
                  <Fig label="Target" value={`${c.targetReviews}`} Icon={Target} />
                  <Fig label="Collected" value={`${c.collected}`} Icon={CheckCircle2} />
                  <Fig label="Progress" value={`${pct}%`} Icon={BarChart3} />
                </dl>

                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                  <div className={`h-full rounded-full ${barTone} transition-all duration-700 ease-out`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Fig({ label, value, Icon }) {
  return (
    <div className="group rounded-btn border border-default bg-surface p-3 transition-colors duration-200 hover:bg-surface-sunken">
      <dt className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
        <Icon className="h-3 w-3" aria-hidden="true" />
        {label}
      </dt>
      <dd className="nums mt-0.5 text-base font-bold tracking-tight text-primary">{value}</dd>
    </div>
  );
}
