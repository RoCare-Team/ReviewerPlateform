import crypto from "node:crypto";
import dbConnect from "../../../../lib/db";
import Campaign from "../../../../models/Campaign";
import Submission from "../../../../models/Submission";
import Claim from "../../../../models/Claim";
import { apiRequirePermission } from "../../../../lib/auth/guards";
import { uploadImage, cloudinaryConfigured } from "../../../../lib/cloudinary";
import { verifyScreenshot, AI_CONFIDENCE_THRESHOLD } from "../../../../lib/aiVerification";
import { verifyAgainstGmb } from "../../../../lib/gmbVerification";
import { approveSubmission, rejectSubmission } from "../../../../lib/verification";
import { releaseClaim } from "../../../../lib/claims";
import { getSettings } from "../../../../lib/settings";

/**
 * Reviewer submits their participation in a campaign with a screenshot proof.
 * Guarded by feedback:submit. Multipart form-data: { campaignId, note, screenshot }.
 *
 * The screenshot is uploaded to Cloudinary (signed) and referenced by URL — never
 * stored on the app server. All uploads validate type, size and magic bytes.
 *
 * Two-step auto-verification after upload:
 *   1. AI (gpt-4o-mini vision, lib/aiVerification.js) looks at the screenshot itself.
 *   2. If the campaign is linked to a Google Business Profile location
 *      (Campaign.location), lib/gmbVerification.js cross-checks that a matching
 *      review actually landed on Google.
 * The reviewer is only auto-approved and paid instantly when step 1 confidently
 * approves AND — whenever a location is linked — step 2 finds a matching review.
 * A confident AI *rejection* short-circuits immediately (no point checking Google
 * for a screenshot that already fails). Anything else (no AI key, low confidence,
 * AI approves but Google hasn't shown the review yet, no location linked) lands
 * as `pending` for an admin, who sees both verdicts and can always override.
 */
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

// Magic-byte signatures so a renamed non-image can't slip past the mime check.
function sniffImage(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

export async function POST(request) {
  const { user, response } = await apiRequirePermission("feedback:submit");
  if (response) return response;

  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: "Invalid form data" }, { status: 400 });

  const campaignId = form.get("campaignId");
  const note = String(form.get("note") ?? "").slice(0, 500);
  const file = form.get("screenshot");

  if (!campaignId || typeof file !== "object" || typeof file.arrayBuffer !== "function") {
    return Response.json({ error: "Screenshot and campaign are required." }, { status: 400 });
  }
  if (!ALLOWED[file.type]) return Response.json({ error: "Screenshot must be PNG, JPG or WebP." }, { status: 400 });
  if (file.size === 0) return Response.json({ error: "The screenshot file is empty." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "Screenshot must be under 5 MB." }, { status: 400 });

  if (!cloudinaryConfigured()) {
    return Response.json({ error: "Image uploads are not configured on the server." }, { status: 503 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffImage(bytes);
  if (!sniffed || sniffed !== file.type) {
    return Response.json({ error: "File doesn't look like a valid image." }, { status: 400 });
  }

  await dbConnect();

  const campaign = await Campaign.findById(campaignId);
  if (!campaign || campaign.status !== "active") {
    return Response.json({ error: "Campaign is not available." }, { status: 400 });
  }
  if (campaign.collected >= campaign.targetReviews) {
    return Response.json({ error: "This campaign has reached its target." }, { status: 400 });
  }

  // A slot must have been reserved via /api/reviewer/campaigns/[id]/claim
  // (clicking "Open review link") before a submission can be accepted — that
  // reservation is what keeps this campaign from being handed out to more
  // reviewers than it has slots for. If the claim expired (default 30 min),
  // the reviewer needs to re-open the link to reserve a fresh slot.
  const claim = await Claim.findOne({ campaign: campaignId, reviewer: user.id, expiresAt: { $gt: new Date() } });
  if (!claim) {
    return Response.json(
      { error: "Your reserved slot expired. Open the review link again to reserve a new one." },
      { status: 400 }
    );
  }

  // One LIVE submission per reviewer per campaign. A previously rejected one
  // isn't live — it's overwritten in place below so the reviewer can retry.
  const existing = await Submission.findOne({ campaign: campaign._id, reviewer: user.id });
  if (existing && existing.status !== "rejected") {
    return Response.json({ error: "You've already submitted for this campaign." }, { status: 409 });
  }

  // Free fraud check: reject a reused screenshot (excluding the reviewer's own
  // prior rejected attempt on this same campaign).
  const screenshotHash = crypto.createHash("sha256").update(bytes).digest("hex");
  const dup = await Submission.findOne({
    screenshotHash,
    ...(existing ? { _id: { $ne: existing._id } } : {}),
  });
  if (dup) {
    return Response.json({ error: "This screenshot has already been used." }, { status: 409 });
  }

  // Upload the screenshot to Cloudinary (signed).
  let upload;
  try {
    upload = await uploadImage(bytes, file.type);
  } catch (e) {
    return Response.json({ error: `Upload failed: ${e.message}` }, { status: 502 });
  }

  // Step 1 — AI looks at the screenshot itself.
  const ai = await verifyScreenshot(upload.url, {
    platform: campaign.platform,
  });
  const aiFields = { aiDecision: ai.decision, aiConfidence: ai.confidence, aiReason: ai.reason };

  // Step 2 — cross-check against the connected Google Business Profile. Only
  // worth running if the AI hasn't already confidently rejected the screenshot.
  const skipGmb = ai.decision === "reject" && ai.confidence >= AI_CONFIDENCE_THRESHOLD;
  const gmb = skipGmb
    ? { checked: false, matched: false, reviewId: "", reason: "Skipped — AI already rejected the screenshot." }
    : await verifyAgainstGmb({ campaign, reviewerUser: user });
  const gmbFields = {
    gmbChecked: gmb.checked,
    gmbMatched: gmb.matched,
    gmbReviewId: gmb.reviewId || "",
    gmbReason: gmb.reason,
  };

  let submission;
  if (existing) {
    // Resubmission after a rejection — overwrite the same doc, resetting every
    // reviewed field so a stale rejection can't linger on the new attempt.
    submission = await Submission.findOneAndUpdate(
      { _id: existing._id, status: "rejected" },
      {
        $set: {
          screenshotUrl: upload.url,
          screenshotPublicId: upload.publicId,
          screenshotHash,
          note,
          status: "pending",
          rejectionReason: "",
          verifiedBy: "",
          rewardAmount: 0,
          reviewedBy: null,
          reviewedAt: null,
          // A fresh attempt supersedes any earlier appeal on the rejection
          // it's replacing — nothing left to dispute once it's pending again.
          appealStatus: "none",
          appealMessage: "",
          appealedAt: null,
          appealResponse: "",
          appealResolvedAt: null,
          ...aiFields,
          ...gmbFields,
        },
      },
      { returnDocument: "after" }
    );
    if (!submission) {
      return Response.json({ error: "You've already submitted for this campaign." }, { status: 409 });
    }
  } else {
    try {
      submission = await Submission.create({
        campaign: campaign._id,
        reviewer: user.id,
        business: campaign.user,
        screenshotUrl: upload.url,
        screenshotPublicId: upload.publicId,
        screenshotHash,
        note,
        status: "pending",
        ...aiFields,
        ...gmbFields,
      });
    } catch (e) {
      if (e?.code === 11000) {
        return Response.json({ error: "You've already submitted for this campaign." }, { status: 409 });
      }
      throw e;
    }
  }

  // The claim has done its job — the reservation is now a `pending`
  // Submission instead, which has no timeout. `claimed` on the campaign
  // stays as-is; it's only released once this submission is approved or
  // rejected (see lib/verification.js).
  await releaseClaim(campaign._id, user.id);

  const aiApproved = ai.decision === "approve" && ai.confidence >= AI_CONFIDENCE_THRESHOLD;
  const aiRejected = ai.decision === "reject" && ai.confidence >= AI_CONFIDENCE_THRESHOLD;
  // When a location IS linked, both steps must agree to auto-approve. When
  // none is linked, gmb.checked is false and step 1 alone decides — same
  // behavior as before this feature existed for campaigns with no GMB link.
  const gmbBlocksApproval = gmb.checked && !gmb.matched;

  if (aiApproved && !gmbBlocksApproval) {
    const settings = await getSettings();
    // settings.reviewerReward is only the FALLBACK — approveSubmission pays
    // this campaign's own reviewerReward override instead when the admin has
    // set one, and hands back whichever amount actually got paid.
    const { outcome, reward } = await approveSubmission(submission._id, settings.reviewerReward, { verifiedBy: "ai" });
    if (outcome === "approved") {
      return Response.json({ ok: true, status: "approved", reward, reason: ai.reason });
    }
    if (outcome === "campaign_full") {
      return Response.json({ ok: true, status: "rejected", reason: "Campaign already reached its review target." });
    }
    // "already_processed" shouldn't happen for a brand-new/just-reset submission,
    // but fall through to pending rather than erroring.
  } else if (aiRejected) {
    await rejectSubmission(submission._id, ai.reason || "Screenshot did not pass AI verification.", { verifiedBy: "ai" });
    return Response.json({ ok: true, status: "rejected", reason: ai.reason || "Screenshot did not pass AI verification." });
  }

  // AI approved but Google hasn't shown a matching review yet (or AI/Google
  // are both uncertain) — stays pending for an admin, who sees both verdicts.
  const reason =
    aiApproved && gmbBlocksApproval
      ? "AI verified your screenshot, but we couldn't find a matching review on Google yet. An admin will check manually."
      : "Submitted for review. You'll be paid once it's verified.";
  return Response.json({ ok: true, status: "pending", reason });
}
