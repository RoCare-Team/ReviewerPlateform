import { Megaphone } from "lucide-react";
import { requireRole } from "../../../../lib/auth/guards";
import { ROLES } from "../../../../lib/auth/roles";
import dbConnect from "../../../../lib/db";
import User from "../../../../models/User";
import Campaign from "../../../../models/Campaign";
import GmbLocation from "../../../../models/GmbLocation";
import NewCampaignForm from "../../../../components/business/NewCampaignForm";
import CampaignCard from "../../../../components/business/CampaignCard";
import { inr } from "../../../../lib/campaigns";
import { getSettings } from "../../../../lib/settings";

export const metadata = { title: "Campaigns · ReviewHub Business" };

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
          {campaigns.map((c) => (
            <CampaignCard
              key={String(c._id)}
              campaign={{
                id: String(c._id),
                name: c.name,
                platform: c.platform,
                status: c.status,
                notes: c.notes,
                targetUrl: c.targetUrl,
                collected: c.collected ?? 0,
                targetReviews: c.targetReviews,
                budget: c.budget,
                ratePerReview: c.ratePerReview,
                createdAt: c.createdAt ? c.createdAt.toISOString() : null,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
