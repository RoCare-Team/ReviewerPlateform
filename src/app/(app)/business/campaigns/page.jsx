import { Megaphone } from "lucide-react";
import { requireRole } from "../../../../lib/auth/guards";
import { ROLES } from "../../../../lib/auth/roles";
import dbConnect from "../../../../lib/db";
import User from "../../../../models/User";
import Campaign from "../../../../models/Campaign";
import GmbLocation from "../../../../models/GmbLocation";
import NewCampaignForm from "../../../../components/business/NewCampaignForm";
import { inr } from "../../../../lib/campaigns";
import { getSettings } from "../../../../lib/settings";

export const metadata = { title: "Campaigns · ReviewHub Business" };

const STATUS_STYLES = { active: "pill-verified", paused: "pill-pending", draft: "pill-accent", completed: "pill-accent" };
const PLATFORM_LABEL = { google: "Google", trustpilot: "Trustpilot", capterra: "Capterra", amazon: "Amazon", playstore: "Play Store" };

export default async function BusinessCampaignsPage() {
  const user = await requireRole(ROLES.BUSINESS_OWNER);

  await dbConnect();
  const [me, campaigns, locs, settings] = await Promise.all([
    User.findById(user.id).select("walletBalance").lean(),
    Campaign.find({ user: user.id }).sort({ createdAt: -1 }).lean(),
    GmbLocation.find({ user: user.id }).select("title locationName").lean(),
    getSettings(),
  ]);

  const locations = locs.map((l) => ({ id: String(l._id), title: l.title || l.locationName }));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Campaigns</h1>
          <p className="mt-2 text-secondary">Fund a campaign from your wallet — {inr(settings.reviewRate)} per verified review.</p>
        </div>
        <NewCampaignForm walletBalance={me?.walletBalance ?? 0} locations={locations} rate={settings.reviewRate} />
      </div>

      {campaigns.length === 0 ? (
        <div className="mt-8 rounded-card border border-dashed border-default bg-surface-raised p-10 text-center">
          <Megaphone className="mx-auto h-8 w-8 text-muted" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-primary">No campaigns yet</p>
          <p className="mt-1 text-sm text-secondary">Create your first campaign to start collecting verified reviews.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {campaigns.map((c) => {
            const pct = c.targetReviews ? Math.min(100, Math.round((c.collected / c.targetReviews) * 100)) : 0;
            return (
              <div key={String(c._id)} className="rounded-card border border-default bg-surface-raised p-6 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-primary">{c.name}</h3>
                    <p className="mt-0.5 text-xs font-medium text-muted">{PLATFORM_LABEL[c.platform] ?? c.platform}</p>
                  </div>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[c.status]}`}>
                    {c.status}
                  </span>
                </div>

                {c.notes && <p className="mt-3 text-sm leading-relaxed text-secondary">{c.notes}</p>}

                {c.targetUrl && (
                  <a
                    href={c.targetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-block max-w-full truncate text-sm font-semibold text-accent hover:underline"
                    title={c.targetUrl}
                  >
                    {c.targetUrl}
                  </a>
                )}

                <div className="mt-5">
                  <div className="flex items-center justify-between text-xs font-medium text-secondary">
                    <span>{c.collected} / {c.targetReviews} reviews</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-sunken">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <dl className="mt-5 grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <dt className="text-muted">Budget</dt>
                    <dd className="font-bold text-primary">{inr(c.budget)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Rate</dt>
                    <dd className="font-bold text-primary">{inr(c.ratePerReview)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Target</dt>
                    <dd className="font-bold text-primary">{c.targetReviews}</dd>
                  </div>
                </dl>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
