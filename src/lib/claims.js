import Campaign from "../models/Campaign";
import Claim, { CLAIM_TTL_MINUTES } from "../models/Claim";

/**
 * Slot-reservation logic shared by the claim API route and the reviewer
 * campaigns list. See Campaign.claimed and models/Claim.js for the "why".
 */

/**
 * Best-effort cleanup: delete this campaign's claims whose TTL has already
 * passed and give their slots back. Mongo's TTL sweep does this on its own
 * within ~60s too, but calling this before a capacity check means a slot
 * freed by an abandoned claim is available immediately rather than after
 * waiting on the background sweep.
 */
export async function releaseExpiredClaims(campaignId) {
  const expired = await Claim.find({ campaign: campaignId, expiresAt: { $lte: new Date() } }).select("_id");
  if (expired.length === 0) return;
  await Claim.deleteMany({ _id: { $in: expired.map((c) => c._id) } });
  await Campaign.updateOne(
    { _id: campaignId, claimed: { $gte: expired.length } },
    { $inc: { claimed: -expired.length } }
  );
}

/**
 * Reserve a slot for `reviewerId` on `campaignId` and return the campaign's
 * review link — the only way the review URL is ever handed to a reviewer.
 * Reopening the link while a claim is still live just renews its timer
 * instead of double-booking.
 *
 * Returns { ok: true, targetUrl, expiresAt } or { ok: false, error }.
 *
 * Capacity is enforced with the same atomic-conditional-update pattern as
 * `approveSubmission` (lib/verification.js): `$expr` on collected+claimed
 * guards the increment, so two reviewers racing for the last slot can never
 * both win it.
 */
export async function claimSlot(campaignId, reviewerId) {
  await releaseExpiredClaims(campaignId);

  const campaign = await Campaign.findById(campaignId);
  if (!campaign || campaign.status !== "active") {
    return { ok: false, error: "Campaign is not available." };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + CLAIM_TTL_MINUTES * 60 * 1000);

  // Renew an existing live claim rather than reserving a second slot.
  const existing = await Claim.findOne({ campaign: campaignId, reviewer: reviewerId });
  if (existing) {
    existing.expiresAt = expiresAt;
    await existing.save();
    return { ok: true, targetUrl: campaign.targetUrl, expiresAt };
  }

  const reserved = await Campaign.findOneAndUpdate(
    { _id: campaignId, status: "active", $expr: { $lt: [{ $add: ["$collected", "$claimed"] }, "$targetReviews"] } },
    { $inc: { claimed: 1 } },
    { returnDocument: "after" }
  );
  if (!reserved) {
    return { ok: false, error: "This campaign just filled up — check back if a spot opens up." };
  }

  try {
    await Claim.create({ campaign: campaignId, reviewer: reviewerId, expiresAt });
  } catch (e) {
    // Lost a race to a duplicate claim attempt from the same reviewer — give
    // the slot we just reserved back.
    await Campaign.updateOne({ _id: campaignId }, { $inc: { claimed: -1 } });
    if (e?.code === 11000) {
      const claim = await Claim.findOne({ campaign: campaignId, reviewer: reviewerId });
      if (claim) return { ok: true, targetUrl: campaign.targetUrl, expiresAt: claim.expiresAt };
    }
    throw e;
  }

  return { ok: true, targetUrl: campaign.targetUrl, expiresAt };
}

/**
 * Release the slot claimed by `reviewerId` for `campaignId` — call once the
 * reservation is no longer needed. Two distinct cases, and only one of them
 * also frees a `claimed` slot:
 *  - `keepReserved: true` (default): the claim converted into a `pending`
 *    Submission — the Claim doc (and its TTL timer) is no longer needed
 *    since the submission itself has no timeout, but the slot stays
 *    reserved (`claimed` untouched) until that submission is approved or
 *    rejected — see approveSubmission/rejectSubmission in lib/verification.js.
 *  - `keepReserved: false`: the claim is being abandoned without a
 *    submission (not currently wired up anywhere, kept for completeness).
 */
export async function releaseClaim(campaignId, reviewerId, { keepReserved = true } = {}) {
  const deleted = await Claim.findOneAndDelete({ campaign: campaignId, reviewer: reviewerId });
  if (deleted && !keepReserved) {
    await Campaign.updateOne({ _id: campaignId, claimed: { $gte: 1 } }, { $inc: { claimed: -1 } });
  }
}
