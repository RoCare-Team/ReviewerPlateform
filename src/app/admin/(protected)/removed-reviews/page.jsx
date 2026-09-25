import { CheckCircle2, HelpCircle, RotateCcw, ShieldAlert } from "lucide-react";
import { requireAdmin } from "../../../../lib/auth/guards";
import dbConnect from "../../../../lib/db";
import Submission from "../../../../models/Submission";
import Campaign from "../../../../models/Campaign";
import User from "../../../../models/User";
import { inr, getSettings } from "../../../../lib/settings";
import { AUTO_REVERSE_MIN_MISSES, MISSING_STREAK_TO_FLAG } from "../../../../lib/reviewMonitor";
import StatCard from "../../../../components/shared/StatCard";
import RemovedReviewQueue from "../../../../components/admin/RemovedReviewQueue";
import RecheckNowButton from "../../../../components/admin/RecheckNowButton";

export const metadata = { title: "Removed reviews · Admin", robots: { index: false } };

/**
 * Paid reviews that are no longer on Google.
 *
 * Three kinds of row, and which one a submission becomes is decided entirely
 * by how good the evidence was (see lib/reviewMonitor.js):
 *
 *   Auto-reversed — the checker read the whole listing, Google's own count
 *     agreed with what its API returned, and the review wasn't in it. The
 *     reward was taken back out of the reviewer's wallet without asking. Listed
 *     here so an admin can see what happened and approve it again if the
 *     review turns out to be there after all.
 *   Needs a decision — the review wasn't in the listing, but the read was
 *     incomplete (Google counts more reviews than it hands over), so no money
 *     was moved. A human judges these.
 *   Dismissed — an admin judged one of those fine.
 *
 * The counters at the top deliberately cover the whole monitored population,
 * not just the rows below: "12 need a decision" only means something next to
 * how many were checked and found fine.
 */

/** Sum of `field` over submissions matching `match`. */
async function sumOver(match, field = "$rewardAmount") {
  const [row] = await Submission.aggregate([{ $match: match }, { $group: { _id: null, sum: { $sum: field } } }]);
  return row?.sum ?? 0;
}

export default async function AdminRemovedReviewsPage() {
  await requireAdmin();
  await dbConnect();

  const AUTO_REVERSED = { status: "rejected", reviewAutoReversedAt: { $ne: null } };

  const [
    flaggedSubs,
    reversedSubs,
    settings,
    nMissing,
    nDismissed,
    nPresent,
    nWatching,
    nInconclusive,
    nUncheckable,
    moneyMissing,
    moneyReclaimed,
  ] = await Promise.all([
    Submission.find({ status: "approved", reviewLiveStatus: { $in: ["missing", "dismissed"] } })
      .select(
        "campaign reviewer rewardAmount createdAt reviewedAt reviewLiveStatus reviewMissingSince reviewMissingStreak reviewCheckedAt reviewCheckNote"
      )
      .sort({ reviewMissingSince: 1 })
      .limit(500)
      .lean(),
    // The reward is zeroed on the submission when it's reversed, so the amount
    // taken back has to come off the ledger entry, not off rewardAmount — see
    // the WalletTransaction written by unverifySubmission.
    Submission.find(AUTO_REVERSED)
      .select("campaign reviewer createdAt reviewedAt reviewAutoReversedAt reviewMissingStreak reviewCheckedAt reviewCheckNote rejectionReason")
      .sort({ reviewAutoReversedAt: -1 })
      .limit(500)
      .lean(),
    getSettings(),
    Submission.countDocuments({ status: "approved", reviewLiveStatus: "missing" }),
    Submission.countDocuments({ status: "approved", reviewLiveStatus: "dismissed" }),
    Submission.countDocuments({ status: "approved", reviewLiveStatus: "present" }),
    // Seen missing once, not yet the two-in-a-row needed to flag.
    //
    // Matched with $nin rather than `reviewLiveStatus: "unchecked"` on purpose:
    // the monitoring fields were added to the schema after these documents
    // existed, and a Mongoose default only applies when a document is written —
    // every submission approved before then simply has no `reviewLiveStatus` at
    // all. Mongo treats a missing field as null, so "not one of the decided
    // values" catches both the explicit default and the older documents;
    // equality against "unchecked" silently misses every one of them.
    Submission.countDocuments({
      status: "approved",
      reviewMissingStreak: { $gte: 1 },
      reviewLiveStatus: { $nin: ["missing", "dismissed"] },
    }),
    // Looked at, but the listing couldn't be read — a revoked Google
    // connection, an API error, or a listing too big to page through.
    // Explicitly NOT evidence of removal. An inconclusive check never writes
    // the streak, so on an older document that field is still absent — hence
    // $not/$gte rather than `: 0`.
    Submission.countDocuments({
      status: "approved",
      reviewCheckedAt: { $ne: null },
      reviewMissingStreak: { $not: { $gte: 1 } },
      reviewLiveStatus: { $nin: ["missing", "dismissed", "present"] },
    }),
    // Approved on the screenshot alone — no Google review id was ever
    // recorded, so there is nothing to look up.
    Submission.countDocuments({
      status: "approved",
      $or: [{ gmbMatched: { $ne: true } }, { gmbReviewId: { $in: ["", null] } }],
    }),
    sumOver({ status: "approved", reviewLiveStatus: "missing" }),
    sumOver(AUTO_REVERSED, "$rewardAmount"),
  ]);

  // Reversed by the checker, then credited back by it when the review turned
  // up again. Worth showing: it is the number that says the safeguards are
  // doing something rather than just being described.
  const nRestored = await Submission.countDocuments({ reviewRestoredAt: { $ne: null } });

  const nReversed = reversedSubs.length;

  const allSubs = [...flaggedSubs, ...reversedSubs];
  const campaigns = await Campaign.find({ _id: { $in: allSubs.map((s) => s.campaign) } })
    .select("name businessName targetUrl reviewerReward")
    .lean();
  const reviewers = await User.find({ _id: { $in: allSubs.map((s) => s.reviewer) } })
    .select("name email walletBalance")
    .lean();

  const cMap = new Map(campaigns.map((c) => [String(c._id), c]));
  const rMap = new Map(reviewers.map((r) => [String(r._id), r]));
  const fmt = (d) => (d ? new Date(d).toLocaleString("en-IN") : "");

  const toRow = (s, bucket) => {
    const c = cMap.get(String(s.campaign));
    const r = rMap.get(String(s.reviewer));
    return {
      id: String(s._id),
      bucket,
      // A reversed submission has had rewardAmount zeroed, so fall back to what
      // this campaign pays — that is the figure that left the reviewer.
      rewardAmount: s.rewardAmount || c?.reviewerReward || settings.reviewerReward,
      missingStreak: s.reviewMissingStreak || 0,
      missingSince: fmt(s.reviewMissingSince),
      reversedAt: fmt(s.reviewAutoReversedAt),
      checkedDate: fmt(s.reviewCheckedAt),
      checkNote: s.reviewCheckNote || "",
      campaignName: c?.name ?? "Campaign",
      businessName: c?.businessName ?? "",
      targetUrl: c?.targetUrl ?? "",
      reviewerName: r?.name ?? "",
      reviewerEmail: r?.email ?? "",
      reviewerBalance: r?.walletBalance ?? 0,
      date: fmt(s.createdAt),
      reviewedDate: fmt(s.reviewedAt),
    };
  };

  const rows = [
    ...flaggedSubs.map((s) => toRow(s, s.reviewLiveStatus)),
    ...reversedSubs.map((s) => toRow(s, "reversed")),
  ];

  const monitored = nMissing + nDismissed + nPresent + nWatching + nInconclusive;
  const goneRate = monitored > 0 ? Math.round((nMissing / monitored) * 100) : 0;

  // Built as one string, not "text {expr} text": a bare space sitting next to
  // a JSX expression gets swallowed here, which read as "2 checksin a row".
  const intro = settings.autoReverseRemovedReviews
    ? `Every paid review is re-checked on Google once a day. A reward is only taken back when the whole listing could ` +
      `be read and the review was missing from ${AUTO_REVERSE_MIN_MISSES} of those checks a day apart — one bad read ` +
      `never costs a reviewer anything, and if the review turns up later the reward is credited back automatically. ` +
      `When the listing can't be read in full, nothing is deducted at all: those land below after ` +
      `${MISSING_STREAK_TO_FLAG} failed checks, for you to decide.`
    : `Every paid review is re-checked on Google once a day. Automatic reversal is currently OFF, so nothing is ` +
      `deducted on its own — a review that can't be found for ${MISSING_STREAK_TO_FLAG} checks in a row lands below ` +
      `for you to reverse or dismiss. Turn it back on from Pricing.`;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-primary">Removed reviews</h1>
      <p className="mt-2 max-w-3xl text-secondary">{intro}</p>

      <section className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Auto-reversed"
          value={nReversed}
          Icon={RotateCcw}
          tone={nReversed > 0 ? "text-danger" : "text-accent"}
          sub={
            nRestored > 0
              ? `${inr(moneyReclaimed)} taken back · ${nRestored} credited back when the review returned`
              : `${inr(moneyReclaimed)} taken back automatically`
          }
        />
        <StatCard
          label="Needs a decision"
          value={nMissing}
          Icon={ShieldAlert}
          tone={nMissing > 0 ? "text-pending" : "text-accent"}
          sub={`${inr(moneyMissing)} held pending your call`}
        />
        <StatCard
          label="Still live on Google"
          value={nPresent}
          Icon={CheckCircle2}
          tone="text-verified"
          sub={monitored > 0 ? `${goneRate}% of monitored reviews are gone` : "Nothing checked yet"}
        />
        <StatCard
          label="Couldn't check"
          value={nInconclusive + nUncheckable}
          Icon={HelpCircle}
          tone="text-pending"
          sub={`${nInconclusive} unreadable listing · ${nUncheckable} screenshot-only`}
        />
      </section>

      {nWatching > 0 && (
        <p className="mt-4 text-sm text-secondary">
          {`${nWatching} more missed a check but haven't met the bar for anything yet — no money has moved for them.`}
        </p>
      )}

      <div className="mt-6">
        <RecheckNowButton />
      </div>

      <div className="mt-8">
        <RemovedReviewQueue rows={rows} autoReverseOn={settings.autoReverseRemovedReviews} />
      </div>
    </div>
  );
}
