import Link from "next/link";
import { ArrowRight, Megaphone } from "lucide-react";
import { requireRole } from "../../../lib/auth/guards";
import { ROLES } from "../../../lib/auth/roles";
import dbConnect from "../../../lib/db";
import User from "../../../models/User";
import Submission from "../../../models/Submission";
import { getSettings, inr } from "../../../lib/settings";
import { getAvailableCampaignsForReviewer, getReviewerCooldownState } from "../../../lib/reviewerCampaigns";
import OverviewStats from "../../../components/reviewer/OverviewStats";
import ReviewerCooldownNotice from "../../../components/reviewer/ReviewerCooldownNotice";

export const metadata = { title: "Your dashboard · RapportLook" };

export default async function ReviewerHomePage() {
  const user = await requireRole(ROLES.REVIEWER);

  await dbConnect();
  const settings = await getSettings();

  const [me, mySubs, available, cooldown] = await Promise.all([
    User.findById(user.id).select("walletBalance").lean(),
    Submission.find({ reviewer: user.id }).select("campaign status").lean(),
    // Same city/pacing/claimed-slots rules as /reviewer/campaigns — this used
    // to be its own shortcut filter (collected-only, no city, no pacing) so
    // the count here could say "4" while the actual list showed fewer/none.
    getAvailableCampaignsForReviewer(user.id),
    getReviewerCooldownState(user.id),
  ]);

  const approved = mySubs.filter((s) => s.status === "approved").length;
  const pending = mySubs.filter((s) => s.status === "pending").length;
  const rejected = mySubs.filter((s) => s.status === "rejected").length;
  const availableCount = available.length;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-primary">
        Hi{user.name ? `, ${user.name}` : ""}
      </h1>
      <p className="mt-2 hidden text-secondary sm:block">
        Earn {inr(settings.reviewerReward)} for every verified review. Rewards are for verified
        participation, never for positive ratings.
      </p>

      {/* Sits above the "N campaigns waiting" CTA on purpose — otherwise the
          dashboard invites a booking the server is about to refuse. */}
      <ReviewerCooldownNotice cooldown={cooldown} />

      {/* Special CTA — the stat tile below still has the same number, but
          this is the one thing on the page that actually wants a click:
          a bold, standalone button instead of blending in as just another
          tile. Only bothers rendering when there's actually something to
          claim. */}
      {availableCount > 0 && (
        <Link
          href="/reviewer/campaigns"
          className="group relative mt-6 flex items-center gap-3 overflow-hidden rounded-card bg-accent p-4 text-on-brand shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl sm:gap-4 sm:p-5"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 transition-transform duration-500 group-hover:scale-125"
          />
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 transition-transform duration-300 group-hover:scale-110 sm:h-12 sm:w-12 sm:rounded-2xl">
            <Megaphone className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
          </span>
          <div className="relative min-w-0 flex-1">
            <p className="text-sm font-bold leading-snug sm:text-base">
              {availableCount} campaign{availableCount === 1 ? "" : "s"} waiting for you
            </p>
            <p className="mt-0.5 text-xs text-on-brand/85 sm:text-sm">Book a slot now and start earning.</p>
          </div>
          <ArrowRight
            className="relative h-4 w-4 shrink-0 transition-transform duration-300 group-hover:translate-x-1 sm:h-5 sm:w-5"
            aria-hidden="true"
          />
        </Link>
      )}

      {/* Overview: stat tiles (Available campaigns leads, top-left) +
          submission status breakdown. Used to be a separate banner further
          down the page — now it's just the first tile here, same as every
          other number on this page. */}
      <div className="mt-8">
        <OverviewStats
          walletBalance={me?.walletBalance ?? 0}
          formattedWallet={inr(me?.walletBalance ?? 0)}
          approved={approved}
          pending={pending}
          rejected={rejected}
          availableCount={availableCount}
        />
      </div>
    </div>
  );
}
