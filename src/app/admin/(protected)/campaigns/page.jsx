import { Megaphone, ExternalLink } from "lucide-react";
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
    { key: "", label: "All" },
    { key: "active", label: "Active" },
    { key: "completed", label: "Completed" },
    { key: "paused", label: "Paused" },
    { key: "draft", label: "Draft" },
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
      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map((t) => {
          const active = (statusFilter ?? "") === t.key;
          return (
            <a
              key={t.label}
              href={t.key ? `/admin/campaigns?status=${t.key}` : "/admin/campaigns"}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
                active ? "border-accent bg-accent-subtle text-accent" : "border-default bg-surface text-secondary hover:bg-surface-sunken"
              }`}
            >
              {t.label}
            </a>
          );
        })}
      </div>

      {campaigns.length === 0 ? (
        <div className="mt-8 rounded-card border border-dashed border-default bg-surface-raised p-10 text-center">
          <p className="text-sm text-secondary">No campaigns found.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {campaigns.map((c) => {
            const owner = oMap.get(String(c.user));
            const pending = pendingMap.get(String(c._id)) ?? 0;
            const pct = c.targetReviews ? Math.min(100, Math.round((c.collected / c.targetReviews) * 100)) : 0;
            return (
              <div key={String(c._id)} className="rounded-card border border-default bg-surface-raised p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
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
                      className="inline-flex max-w-[16rem] items-center gap-1 truncate text-xs font-semibold text-accent hover:underline">
                      Review link <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    </a>
                  )}
                </div>

                {c.notes && <p className="mt-3 text-sm text-secondary">{c.notes}</p>}

                {/* Figures */}
                <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <Fig label="Budget" value={inr(c.budget)} />
                  <Fig label="Rate" value={inr(c.ratePerReview)} />
                  <Fig label="Target" value={`${c.targetReviews}`} />
                  <Fig label="Collected" value={`${c.collected}`} />
                  <Fig label="Progress" value={`${pct}%`} />
                </dl>

                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Fig({ label, value }) {
  return (
    <div className="rounded-btn border border-default bg-surface p-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-base font-extrabold tracking-tight text-primary">{value}</dd>
    </div>
  );
}
