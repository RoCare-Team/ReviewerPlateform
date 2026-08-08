import mongoose from "mongoose";
import Image from "next/image";
import Link from "next/link";
import { Star, MapPin, CheckCircle2, ArrowRight, Plus, RefreshCw } from "lucide-react";
import { requireRole } from "../../../lib/auth/guards";
import { ROLES } from "../../../lib/auth/roles";
import dbConnect from "../../../lib/db";
import User from "../../../models/User";
import GmbConnection from "../../../models/GmbConnection";
import GmbLocation from "../../../models/GmbLocation";
import GmbReview from "../../../models/GmbReview";
import Campaign from "../../../models/Campaign";
import Submission from "../../../models/Submission";
import CampaignStats from "../../../components/business/CampaignStats";
import { inr } from "../../../lib/campaigns";
import { getSettings } from "../../../lib/settings";

export const metadata = { title: "Overview · RapportLook Business" };

const PLATFORM_LABEL = {
  google: "Google",
  trustpilot: "Trustpilot",
  capterra: "Capterra",
  amazon: "Amazon",
  playstore: "Play Store",
};

export default async function BusinessOverviewPage() {
  const user = await requireRole(ROLES.BUSINESS_OWNER);

  await dbConnect();

  const [
    gmbConnections,
    gmbLocations,
    me,
    reviewCount,
    campaigns,
    recentReviews,
    locations,
    submissionAgg,
    settings,
  ] = await Promise.all([
    GmbConnection.countDocuments({ user: user.id, status: "active" }),
    GmbLocation.countDocuments({ user: user.id }),
    User.findById(user.id).select("walletBalance").lean(),
    GmbReview.countDocuments({ user: user.id }),
    Campaign.find({ user: user.id })
      .select("name status budget targetReviews collected platform location ratePerReview")
      .sort({ createdAt: -1 })
      .lean(),
    GmbReview.find({ user: user.id }).sort({ createTime: -1 }).limit(5).lean(),
    GmbLocation.find({ user: user.id }).select("title locationName").lean(),
    // Submission counts per (campaign, status) in one round trip — six campaigns
    // shouldn't mean eighteen countDocuments calls. `business` is the owner, so
    // this can only ever see this user's own submissions.
    //
    // Deliberately NOT summing rewardAmount: that field is the REVIEWER's
    // payout (settings.reviewerReward, ₹50), which is smaller than what the
    // business pays (settings.reviewRate, ₹100) — the difference is platform
    // margin. Showing it on a business screen reads as "budget spent" and
    // understates the real burn. Budget consumption is derived from `collected`
    // × the campaign's own rate below.
    Submission.aggregate([
      // aggregate() skips Mongoose's schema casting, so the id must be a real
      // ObjectId here — a plain string silently matches nothing.
      { $match: { business: new mongoose.Types.ObjectId(String(user.id)) } },
      { $group: { _id: { campaign: "$campaign", status: "$status" }, count: { $sum: 1 } } },
    ]),
    getSettings(),
  ]);

  const gmbConnected = gmbConnections > 0;
  const activeCampaigns = campaigns.filter((c) => c.status === "active").length;
  const spend = campaigns.reduce((s, c) => s + (c.budget ?? 0), 0);
  const target = campaigns.reduce((s, c) => s + (c.targetReviews ?? 0), 0);
  const collected = campaigns.reduce((s, c) => s + (c.collected ?? 0), 0);

  const locationTitle = new Map(
    locations.map((l) => [String(l._id), l.title || l.locationName])
  );

  // campaignId → { pending, approved, rejected }
  const subsByCampaign = new Map();
  const overallSubs = { pending: 0, approved: 0, rejected: 0 };
  for (const row of submissionAgg) {
    const id = String(row._id.campaign);
    const entry = subsByCampaign.get(id) ?? { pending: 0, approved: 0, rejected: 0 };
    entry[row._id.status] = row.count;
    subsByCampaign.set(id, entry);
    overallSubs[row._id.status] += row.count;
  }

  // Account-wide budget consumption — same per-campaign rule (collected × the
  // campaign's own stored rate) summed across every campaign.
  const overallUsed = campaigns.reduce((s, c) => {
    const rate = c.ratePerReview ?? settings.reviewRate;
    return s + Math.min(c.budget ?? 0, (c.collected ?? 0) * rate);
  }, 0);

  // "All campaigns" view — account-wide figures, unchanged from before.
  const overall = {
    id: null,
    collected,
    target,
    approved: overallSubs.approved,
    pending: overallSubs.pending,
    rejected: overallSubs.rejected,
    budget: spend,
    budgetUsed: overallUsed,
    stats: [
      { key: "activeCampaigns", label: "Active campaigns", value: String(activeCampaigns) },
      { key: "reviewsFetched", label: "Reviews fetched", value: String(reviewCount) },
      { key: "target", label: "Target reviews", value: String(target) },
      { key: "locations", label: "Locations", value: String(gmbLocations) },
      { key: "spend", label: "Campaign spend", value: inr(spend) },
      { key: "wallet", label: "Wallet balance", value: inr(me?.walletBalance ?? 0) },
    ],
  };

  // Per-campaign views. Serialized here (no ObjectIds, no Dates) because this
  // crosses the server→client boundary into CampaignStats.
  const campaignViews = campaigns.map((c) => {
    const id = String(c._id);
    const subs = subsByCampaign.get(id) ?? { pending: 0, approved: 0, rejected: 0 };
    // The campaign's OWN stored rate, not the live setting — a rate change by
    // an admin must not retroactively rewrite what an old campaign cost.
    const rate = c.ratePerReview ?? settings.reviewRate;
    const budget = c.budget ?? 0;
    const collectedHere = c.collected ?? 0;

    // What the business has actually spent: one verified review costs `rate`.
    const used = Math.min(budget, collectedHere * rate);

    return {
      id,
      name: c.name,
      status: c.status,
      platformLabel: PLATFORM_LABEL[c.platform] ?? c.platform,
      locationTitle: c.location ? locationTitle.get(String(c.location)) ?? null : null,
      budgetDisplay: inr(budget),
      rateDisplay: inr(rate),
      collected: c.collected ?? 0,
      target: c.targetReviews ?? 0,
      approved: subs.approved,
      pending: subs.pending,
      rejected: subs.rejected,
      budget,
      budgetUsed: used,
      stats: [
        { key: "target", label: "Target reviews", value: String(c.targetReviews ?? 0) },
        {
          key: "collected",
          label: "Verified collected",
          value: String(c.collected ?? 0),
          hint: `${Math.max(0, (c.targetReviews ?? 0) - (c.collected ?? 0))} to go`,
        },
        { key: "pending", label: "Awaiting verification", value: String(subs.pending) },
        { key: "rejected", label: "Rejected submissions", value: String(subs.rejected) },
        { key: "spend", label: "Budget", value: inr(budget), hint: `${inr(rate)} per review` },
        {
          key: "budgetUsed",
          label: "Budget used",
          value: inr(used),
          hint: `${inr(budget - used)} remaining`,
        },
      ],
    };
  });

  return (
    <div>
      {/* 1. Google Business Profile — reflects real DB connection state. Up
          top: whether GMB is connected governs everything below it (reviews,
          campaign targeting), so it needs to be seen first. */}
      <div className="rounded-card border border-accent-border bg-accent-subtle p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-default bg-surface shadow-sm">
              <Image src="/img/google.png" alt="Google" width={28} height={28} className="h-7 w-7 object-contain" />
            </span>
            <div>
              {gmbConnected ? (
                <>
                  <h2 className="inline-flex items-center gap-1.5 text-base font-bold text-primary">
                    <CheckCircle2 className="h-4 w-4 text-verified" aria-hidden="true" />
                    Google Business Profile connected
                  </h2>
                  <p className="mt-0.5 inline-flex flex-wrap items-center gap-x-3 text-sm text-secondary">
                    <span>{gmbConnections} account{gmbConnections > 1 ? "s" : ""}</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                      {gmbLocations} location{gmbLocations === 1 ? "" : "s"}
                    </span>
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-base font-bold text-primary">Connect your Google Business Profile</h2>
                  <p className="mt-0.5 text-sm text-secondary">
                    Link your GMB account to automatically fetch and view your Google reviews.
                  </p>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {gmbConnected ? (
              <Link
                href="/business/connections"
                className="inline-flex items-center gap-2 rounded-btn border border-strong bg-surface px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-surface-sunken"
              >
                Manage connections
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            ) : (
              // Full-page navigation — OAuth-start route, not a page.
              // eslint-disable-next-line @next/next/no-html-link-for-pages
              <a
                href="/api/business/gmb/connect"
                className="inline-flex items-center gap-2 rounded-btn bg-accent px-4 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition hover:bg-accent-hover"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Connect Google Business Profile
              </a>
            )}
          </div>
        </div>
      </div>

      <h1 className="mt-8 text-2xl font-bold tracking-tight text-primary">
        Welcome back{user.name ? `, ${user.name}` : ""}
      </h1>
      <p className="mt-2 text-secondary">
        Your review collection at a glance
        {campaignViews.length > 0 ? " — pick a campaign to scope the numbers to it" : ""}.
      </p>

      {/* 2. Stats — account-wide by default, per-campaign on click. */}
      <div className="mt-8">
        <CampaignStats overall={overall} campaigns={campaignViews} />
      </div>
    </div>
  );
}
