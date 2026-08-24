import { Megaphone } from "lucide-react";
import { requireRole } from "../../../../lib/auth/guards";
import { ROLES } from "../../../../lib/auth/roles";
import dbConnect from "../../../../lib/db";
import User from "../../../../models/User";
import Campaign from "../../../../models/Campaign";
import GmbLocation from "../../../../models/GmbLocation";
import PlayStoreApp from "../../../../models/PlayStoreApp";
import NewCampaignModal from "../../../../components/models/NewCampaignModal";
import CampaignsTable from "../../../../components/business/CampaignsTable";
import { inr, campaignCities, deriveCityFromAddress, deriveLocationLabel } from "../../../../lib/campaigns";
import { getSettings } from "../../../../lib/settings";

export const metadata = { title: "Campaigns · RapportLook Business" };

export default async function BusinessCampaignsPage() {
  const user = await requireRole(ROLES.BUSINESS_OWNER);

  await dbConnect();
  const [me, campaigns, locs, psApps, settings] = await Promise.all([
    User.findById(user.id).select("walletBalance").lean(),
    Campaign.find({ user: user.id }).sort({ createdAt: -1 }).lean(),
    GmbLocation.find({ user: user.id }).select("title locationName reviewUrl address category").lean(),
    PlayStoreApp.find({ user: user.id }).select("label packageName").lean(),
    getSettings(),
  ]);

  // Play Store has no per-app "write a review" link like GMB's newReviewUri —
  // the app's own Play Store page is the closest equivalent (the reviewer
  // taps "Write a review" from there), so that's what auto-fills.
  const playStoreApps = psApps.map((a) => ({
    id: String(a._id),
    label: a.label || a.packageName,
    packageName: a.packageName,
    reviewUrl: `https://play.google.com/store/apps/details?id=${encodeURIComponent(a.packageName)}`,
  }));

  const locations = locs.map((l) => ({
    id: String(l._id),
    title: l.title || l.locationName,
    // Pure city — what campaign.city / reviewer city-matching actually uses.
    // See lib/campaigns.js#deriveCityFromAddress.
    city: deriveCityFromAddress(l.address),
    // "Locality, City" — display only, for the location dropdowns (New/Edit
    // campaign). Two locations in the same city are indistinguishable by
    // `city` alone; this is what tells them apart. See
    // lib/campaigns.js#deriveLocationLabel.
    areaLabel: deriveLocationLabel(l.address),
    reviewUrl: l.reviewUrl || "",
    category: l.category || "",
  }));

  const locationTitleById = new Map(locations.map((l) => [l.id, l.title]));

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Campaigns</h1>
          <p className="mt-2 text-secondary">Fund a campaign from your wallet — {inr(settings.reviewRate)} per verified review.</p>
        </div>
        <NewCampaignModal
          walletBalance={me?.walletBalance ?? 0}
          locations={locations}
          playStoreApps={playStoreApps}
          rate={settings.reviewRate}
        />
      </div>

      {campaigns.length === 0 ? (
        <div className="mt-8 rounded-card border border-dashed border-default bg-surface-raised p-10 text-center">
          <Megaphone className="mx-auto h-8 w-8 text-muted" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-primary">No campaigns yet</p>
          <p className="mt-1 text-sm text-secondary">Create your first campaign to start collecting verified reviews.</p>
        </div>
      ) : (
        <CampaignsTable
          campaigns={campaigns.map((c) => ({
            id: String(c._id),
            name: c.name,
            platform: c.platform,
            status: c.status,
            notes: c.notes,
            targetUrl: c.targetUrl,
            city: c.city,
            cities: campaignCities(c),
            location: c.location ? String(c.location) : "",
            // Prefer the campaign's own snapshot (survives the GMB location
            // being renamed/disconnected later) — falls back to a live
            // lookup only for campaigns created before this was captured.
            locationTitle: c.businessName || (c.location ? locationTitleById.get(String(c.location)) || "" : ""),
            businessCategory: c.businessCategory || "",
            collected: c.collected ?? 0,
            targetReviews: c.targetReviews,
            budget: c.budget,
            ratePerReview: c.ratePerReview,
            createdAt: c.createdAt ? c.createdAt.toISOString() : null,
            // Surfaces what's actually configured on the campaign — the
            // review-draft/image pools set up in NewCampaignModal don't show
            // anywhere else, so the table would otherwise look identical
            // whether or not the owner bothered adding them. Full lists (not
            // just counts) so the expandable details panel can show the
            // actual keyword/review/image content — see CampaignsTable.jsx.
            reviewDrafts: (c.reviewDrafts ?? []).map((d) => ({
              text: d.text,
              keyword: d.keyword || "",
              assigned: Boolean(d.assignedTo),
            })),
            reviewImages: (c.reviewImages ?? []).map((im) => ({
              url: im.url,
              assigned: Boolean(im.assignedTo),
            })),
            pacingLimit: c.pacingLimit ?? null,
            pacingWindowHours: c.pacingWindowHours ?? null,
          }))}
          locations={locations}
          walletBalance={me?.walletBalance ?? 0}
        />
      )}
    </div>
  );
}
