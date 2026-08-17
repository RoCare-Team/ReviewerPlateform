import { Megaphone, Inbox } from "lucide-react";
import { requireAdmin } from "../../../../lib/auth/guards";
import dbConnect from "../../../../lib/db";
import Campaign from "../../../../models/Campaign";
import User from "../../../../models/User";
import Submission from "../../../../models/Submission";
import { getSettings, inr } from "../../../../lib/settings";
import AdminCampaignsTable from "../../../../components/admin/AdminCampaignsTable";

export const metadata = { title: "Campaigns · Admin", robots: { index: false } };

export default async function AdminCampaignsPage({ searchParams }) {
  await requireAdmin();
  const params = await searchParams;
  const statusFilter = params?.status;

  await dbConnect();
  const query = ["active", "completed", "paused", "draft"].includes(statusFilter) ? { status: statusFilter } : {};
  const [campaigns, settings] = await Promise.all([
    Campaign.find(query).sort({ createdAt: -1 }).limit(500).lean(),
    getSettings(),
  ]);

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
        <AdminCampaignsTable
          globalReward={settings.reviewerReward}
          campaigns={campaigns.map((c) => {
            const owner = oMap.get(String(c.user));
            return {
              id: String(c._id),
              name: c.name,
              city: c.city || "",
              platform: c.platform,
              status: c.status,
              notes: c.notes,
              targetUrl: c.targetUrl,
              budget: c.budget,
              ratePerReview: c.ratePerReview,
              reviewerReward: c.reviewerReward ?? null,
              collected: c.collected ?? 0,
              targetReviews: c.targetReviews,
              pending: pendingMap.get(String(c._id)) ?? 0,
              ownerName: owner?.name || owner?.email || "Unknown",
              date: new Date(c.createdAt).toLocaleDateString("en-IN"),
            };
          })}
        />
      )}
    </div>
  );
}
