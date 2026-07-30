import Image from "next/image";
import Link from "next/link";
import { Megaphone, MessageSquare, Star, Wallet, MapPin, CheckCircle2, ArrowRight, Plus, RefreshCw, Target } from "lucide-react";
import { requireRole } from "../../../lib/auth/guards";
import { ROLES } from "../../../lib/auth/roles";
import dbConnect from "../../../lib/db";
import User from "../../../models/User";
import GmbConnection from "../../../models/GmbConnection";
import GmbLocation from "../../../models/GmbLocation";
import GmbReview from "../../../models/GmbReview";
import Campaign from "../../../models/Campaign";
import { inr } from "../../../lib/campaigns";

export const metadata = { title: "Overview · ReviewHub Business" };

export default async function BusinessOverviewPage() {
  const user = await requireRole(ROLES.BUSINESS_OWNER);

  await dbConnect();

  const [gmbConnections, gmbLocations, me, reviewCount, campaigns, recentReviews] =
    await Promise.all([
      GmbConnection.countDocuments({ user: user.id, status: "active" }),
      GmbLocation.countDocuments({ user: user.id }),
      User.findById(user.id).select("walletBalance").lean(),
      GmbReview.countDocuments({ user: user.id }),
      Campaign.find({ user: user.id }).select("status budget targetReviews").lean(),
      GmbReview.find({ user: user.id }).sort({ createTime: -1 }).limit(5).lean(),
    ]);

  const gmbConnected = gmbConnections > 0;
  const activeCampaigns = campaigns.filter((c) => c.status === "active").length;
  const spend = campaigns.reduce((s, c) => s + (c.budget ?? 0), 0);
  const target = campaigns.reduce((s, c) => s + (c.targetReviews ?? 0), 0);

  // Stats at the top — real values from the DB.
  const STATS = [
    { label: "Active campaigns", value: String(activeCampaigns), Icon: Megaphone, tone: "text-accent" },
    { label: "Reviews fetched", value: String(reviewCount), Icon: MessageSquare, tone: "text-accent" },
    { label: "Target reviews", value: String(target), Icon: Target, tone: "text-verified" },
    { label: "Locations", value: String(gmbLocations), Icon: MapPin, tone: "text-accent" },
    { label: "Campaign spend", value: inr(spend), Icon: Star, tone: "text-accent" },
    { label: "Wallet balance", value: inr(me?.walletBalance ?? 0), Icon: Wallet, tone: "text-accent" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-primary">
        Welcome back{user.name ? `, ${user.name}` : ""}
      </h1>
      <p className="mt-2 text-secondary">Your review collection at a glance.</p>

      {/* 1. Stats on top */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STATS.map(({ label, value, Icon, tone }) => (
          <div key={label} className="rounded-card border border-default bg-surface-raised p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm text-secondary">{label}</span>
              <Icon className={`h-5 w-5 ${tone}`} aria-hidden="true" />
            </div>
            <p className="mt-3 text-3xl font-extrabold tracking-tight text-primary">{value}</p>
          </div>
        ))}
      </div>

      {/* 2. Google Business Profile — reflects real DB connection state */}
      <div className="mt-8 rounded-card border border-accent-border bg-accent-subtle p-6 shadow-sm">
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

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-accent-border/60 pt-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">More platforms</span>
          {["Trustpilot", "Capterra", "G2", "Amazon"].map((p) => (
            <span key={p} className="inline-flex items-center gap-1.5 rounded-full border border-default bg-surface px-3 py-1 text-xs font-semibold text-secondary">
              <Plus className="h-3 w-3" aria-hidden="true" />
              {p}
              <span className="rounded-full bg-surface-sunken px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">Soon</span>
            </span>
          ))}
        </div>
      </div>

      {/* 3. Reviews — only when GMB is connected */}
      {gmbConnected && (
        <div className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-primary">Recent Google reviews</h2>
            <Link href="/business/reviews" className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">
              View all
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          {recentReviews.length === 0 ? (
            <div className="mt-4 rounded-card border border-dashed border-default bg-surface-raised p-8 text-center">
              <p className="text-sm text-secondary">
                No reviews synced yet. Go to <Link href="/business/reviews" className="font-semibold text-accent hover:underline">Reviews</Link> and hit Sync.
              </p>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {recentReviews.map((v) => (
                <li key={String(v._id)} className="rounded-card border border-default bg-surface-raised p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-subtle text-sm font-bold text-accent">
                        {(v.reviewerName || "?").charAt(0)}
                      </span>
                      <div>
                        <p className="text-sm font-bold text-primary">{v.reviewerName || "Anonymous"}</p>
                        <p className="text-xs text-muted">
                          Google{v.createTime ? ` · ${new Date(v.createTime).toLocaleDateString("en-IN")}` : ""}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 font-semibold text-primary">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
                      {v.starRating}
                    </span>
                  </div>
                  {v.comment && <p className="mt-2 line-clamp-2 text-sm text-secondary">{v.comment}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
