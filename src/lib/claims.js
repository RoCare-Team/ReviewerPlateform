import Campaign from "../models/Campaign";
import Claim, { CLAIM_TTL_MINUTES } from "../models/Claim";
import { checkPacing } from "./pacing";

/**
 * Slot-reservation logic shared by the claim API route and the reviewer
 * campaigns list. See Campaign.claimed and models/Claim.js for the "why".
 */

/**
 * Free a claim's assigned pool entry (a reviewDrafts or reviewImages
 * subdocument) back to `assignedTo: null` so another reviewer can be handed
 * it. No-op if the claim never had one assigned. Matches on the specific
 * subdocument id, so this can never accidentally free a DIFFERENT reviewer's
 * assignment. `field` is "reviewDrafts" or "reviewImages".
 */
async function releasePoolItem(campaignId, field, itemId) {
  if (!itemId) return;
  await Campaign.updateOne(
    { _id: campaignId, [`${field}._id`]: itemId },
    { $set: { [`${field}.$.assignedTo`]: null, [`${field}.$.assignedAt`]: null } }
  );
}

/**
 * Atomically hand `reviewerId` one still-unassigned entry from
 * Campaign[field] (reviewDrafts or reviewImages), if any exist. Returns the
 * subdocument or null (no pool configured, or every entry is already taken —
 * never treated as an error, both pools are optional). A short retry loop
 * handles the race where two reviewers grab the same free-looking entry at
 * once: the positional `$` update only succeeds if that exact entry is
 * STILL unassigned at write time, so a lost race just falls through to the
 * next candidate instead of double-assigning.
 */
async function assignPoolItem(campaignId, field, reviewerId) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const campaign = await Campaign.findById(campaignId).select(field);
    const candidate = campaign?.[field]?.find((d) => !d.assignedTo);
    if (!candidate) return null;

    const now = new Date();
    const updated = await Campaign.findOneAndUpdate(
      { _id: campaignId, [`${field}._id`]: candidate._id, [`${field}.assignedTo`]: null },
      { $set: { [`${field}.$.assignedTo`]: reviewerId, [`${field}.$.assignedAt`]: now } }
    );
    if (updated) return candidate;
    // Someone else took it between our read and write — try the next one.
  }
  return null;
}

/**
 * Best-effort cleanup: delete this campaign's claims whose TTL has already
 * passed and give their slots (and any assigned review draft/image) back.
 * Mongo's TTL sweep does this on its own within ~60s too, but calling this
 * before a capacity check means a slot freed by an abandoned claim is
 * available immediately rather than after waiting on the background sweep.
 */
export async function releaseExpiredClaims(campaignId) {
  const expired = await Claim.find({ campaign: campaignId, expiresAt: { $lte: new Date() } }).select(
    "_id reviewDraft.draftId reviewImage.imageId"
  );
  if (expired.length === 0) return;
  await Claim.deleteMany({ _id: { $in: expired.map((c) => c._id) } });
  await Campaign.updateOne(
    { _id: campaignId, claimed: { $gte: expired.length } },
    { $inc: { claimed: -expired.length } }
  );
  await Promise.all([
    ...expired.map((c) => releasePoolItem(campaignId, "reviewDrafts", c.reviewDraft?.draftId)),
    ...expired.map((c) => releasePoolItem(campaignId, "reviewImages", c.reviewImage?.imageId)),
  ]);
}

/**
 * Reserve a slot for `reviewerId` on `campaignId` and return the campaign's
 * review link — the only way the review URL is ever handed to a reviewer.
 * Reopening the link while a claim is still live just renews its timer
 * instead of double-booking (and keeps the SAME review draft/image it
 * already assigned, if any).
 *
 * Returns { ok: true, targetUrl, expiresAt, reviewText, imageUrl } or
 * { ok: false, error }. `reviewText`/`imageUrl` are "" when the campaign has
 * no pool configured for that, or every entry is already taken.
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

  // Renew an existing live claim rather than reserving a second slot — its
  // review draft/image (if any) stays exactly as first assigned.
  const existing = await Claim.findOne({ campaign: campaignId, reviewer: reviewerId });
  if (existing) {
    existing.expiresAt = expiresAt;
    await existing.save();
    return {
      ok: true,
      targetUrl: campaign.targetUrl,
      expiresAt,
      reviewText: existing.reviewDraft?.text || "",
      imageUrl: existing.reviewImage?.url || "",
    };
  }

  // Drip pacing (Campaign.pacingLimit/pacingWindowHours) — never blocks
  // renewing an existing claim above, only a genuinely NEW one. See
  // lib/pacing.js for what counts and why this exists.
  const pacing = await checkPacing(campaign);
  if (pacing.blocked) {
    return {
      ok: false,
      error: `This campaign is pacing its reviews — check back after ${pacing.nextAvailableAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}.`,
    };
  }

  const reserved = await Campaign.findOneAndUpdate(
    { _id: campaignId, status: "active", $expr: { $lt: [{ $add: ["$collected", "$claimed"] }, "$targetReviews"] } },
    { $inc: { claimed: 1 } },
    { returnDocument: "after" }
  );
  if (!reserved) {
    return { ok: false, error: "This campaign just filled up — check back if a spot opens up." };
  }

  const draft = await assignPoolItem(campaignId, "reviewDrafts", reviewerId);
  const image = await assignPoolItem(campaignId, "reviewImages", reviewerId);

  try {
    await Claim.create({
      campaign: campaignId,
      reviewer: reviewerId,
      expiresAt,
      reviewDraft: draft ? { draftId: draft._id, text: draft.text } : undefined,
      reviewImage: image ? { imageId: image._id, url: image.url } : undefined,
    });
  } catch (e) {
    // Lost a race to a duplicate claim attempt from the same reviewer — give
    // the slot (and any draft/image) we just reserved back.
    await Campaign.updateOne({ _id: campaignId }, { $inc: { claimed: -1 } });
    if (draft) await releasePoolItem(campaignId, "reviewDrafts", draft._id);
    if (image) await releasePoolItem(campaignId, "reviewImages", image._id);
    if (e?.code === 11000) {
      const claim = await Claim.findOne({ campaign: campaignId, reviewer: reviewerId });
      if (claim) {
        return {
          ok: true,
          targetUrl: campaign.targetUrl,
          expiresAt: claim.expiresAt,
          reviewText: claim.reviewDraft?.text || "",
          imageUrl: claim.reviewImage?.url || "",
        };
      }
    }
    throw e;
  }

  return { ok: true, targetUrl: campaign.targetUrl, expiresAt, reviewText: draft?.text || "", imageUrl: image?.url || "" };
}

/**
 * Release the slot claimed by `reviewerId` for `campaignId` — call once the
 * reservation is no longer needed. Two distinct cases, and only one of them
 * also frees a `claimed` slot (and the assigned review draft/image, if any):
 *  - `keepReserved: true` (default): the claim converted into a `pending`
 *    Submission — the Claim doc (and its TTL timer) is no longer needed
 *    since the submission itself has no timeout, but the slot stays
 *    reserved (`claimed` untouched) until that submission is approved or
 *    rejected — see approveSubmission/rejectSubmission in lib/verification.js.
 *    The review draft/image they were assigned stays permanently spent — it
 *    was used for the review they actually posted, not up for reassignment.
 *  - `keepReserved: false`: the claim is being abandoned without a
 *    submission (not currently wired up anywhere, kept for completeness) —
 *    the draft/image (if any) goes back to the pool along with the slot.
 */
export async function releaseClaim(campaignId, reviewerId, { keepReserved = true } = {}) {
  const deleted = await Claim.findOneAndDelete({ campaign: campaignId, reviewer: reviewerId });
  if (deleted && !keepReserved) {
    await Campaign.updateOne({ _id: campaignId, claimed: { $gte: 1 } }, { $inc: { claimed: -1 } });
    await releasePoolItem(campaignId, "reviewDrafts", deleted.reviewDraft?.draftId);
    await releasePoolItem(campaignId, "reviewImages", deleted.reviewImage?.imageId);
  }
}
