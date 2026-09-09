import mongoose from "mongoose";

/**
 * A reviewer's participation in a campaign: they left a review and uploaded a
 * screenshot as proof. Admin verifies it; on approval the reviewer's wallet is
 * credited the reward and the campaign's collected count grows.
 *
 * One LIVE submission per (campaign, reviewer) — a reviewer can't farm the
 * same campaign repeatedly. A REJECTED submission isn't live: the reviewer
 * can resubmit with a new screenshot, which overwrites this same document
 * (status back to "pending") rather than creating a second one — see
 * src/app/api/reviewer/submissions/route.js.
 */
const SubmissionSchema = new mongoose.Schema(
  {
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", required: true, index: true },
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    business: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    screenshotUrl: { type: String, required: true },
    screenshotPublicId: { type: String, default: "" }, // Cloudinary public id
    screenshotHash: { type: String, default: "", index: true }, // sha256 for dedupe
    note: { type: String, trim: true, default: "" },

    // Client IP this was submitted from (lib/rate-limit.js#clientIp reading the
    // proxy chain). Recorded so lib/pacing.js can hold one review per
    // connection per day — several accounts behind one router is the cheapest
    // review farm there is, and the per-reviewer cap alone doesn't see it.
    // "" when the proxy gave us nothing, which is never counted against anyone.
    submitIp: { type: String, default: "" },

    // AI verification verdict (OpenAI vision). verifiedBy: "ai" | "admin" | "".
    verifiedBy: { type: String, default: "" },
    aiDecision: { type: String, default: "" }, // approve | reject | uncertain
    aiConfidence: { type: Number, default: 0 }, // 0..1
    aiReason: { type: String, default: "" },

    // Step 2: cross-check against the business's connected Google Business
    // Profile (only runs when the campaign is linked to a GmbLocation).
    // gmbChecked=false means the check didn't run at all (no linked location,
    // or the business's Google account isn't connected) — not a failed check.
    gmbChecked: { type: Boolean, default: false },
    gmbMatched: { type: Boolean, default: false },
    gmbReviewId: { type: String, default: "" },
    gmbReason: { type: String, default: "" },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },

    // --- Post-payment review monitoring (lib/reviewMonitor.js) ---
    // An approved submission is money already paid out. If the review later
    // disappears from Google — the reviewer deleted it, or Google removed it —
    // nothing else in the app would ever notice: the GMB cross-check only runs
    // on the way in, and the review sync only ever upserts, so our own copy of
    // a deleted review lives on forever. api/cron/review-recheck looks the
    // review up on Google again and records what it saw here.
    //
    //   unchecked — never looked at (or never had a Google review id to look for)
    //   present   — last check found it live
    //   missing   — gone, confirmed MISSING_STREAK_TO_FLAG checks running;
    //               surfaces at /admin/removed-reviews for a human decision
    //   dismissed — an admin looked and judged it fine; only a later "present"
    //               check undoes this
    // Nothing here ever moves money on its own — see the cron's docblock.
    reviewLiveStatus: {
      type: String,
      enum: ["unchecked", "present", "missing", "dismissed"],
      default: "unchecked",
      index: true,
    },
    reviewCheckedAt: { type: Date, default: null },
    // Consecutive CONCLUSIVE misses. An inconclusive check (API error, revoked
    // Google connection, listing too big to page through) deliberately leaves
    // this alone, so an outage can never accumulate into an accusation.
    reviewMissingStreak: { type: Number, default: 0 },
    reviewMissingSince: { type: Date, default: null },
    // Why the last check concluded what it did, in words an admin can act on.
    reviewCheckNote: { type: String, default: "" },
    // Set when the recheck itself clawed the reward back (AppSettings
    // .autoReverseRemovedReviews) rather than an admin doing it by hand. The
    // submission is "rejected" by then, so this is what keeps it findable —
    // /admin/removed-reviews lists these so an admin can see what the system
    // did overnight, and approve it again if the review turns out to be there.
    reviewAutoReversedAt: { type: Date, default: null },
    rewardAmount: { type: Number, default: 0 },
    rejectionReason: { type: String, default: "" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },

    // A reviewer's dispute of a final rejection — separate from resubmitting
    // with a new screenshot (that's still available too, and better when
    // there's genuinely new proof). An appeal is for "the same screenshot
    // was right, please have a human look again" — no new upload involved.
    // "pending" surfaces it to admins (VerificationQueue); "resolved" once
    // an admin has acted on it, either by approving anyway (see
    // api/admin/submissions/[id]) or by explicitly dismissing the appeal
    // with a response the reviewer can see.
    appealStatus: { type: String, enum: ["none", "pending", "resolved"], default: "none", index: true },
    appealMessage: { type: String, trim: true, default: "" },
    appealedAt: { type: Date, default: null },
    appealResponse: { type: String, trim: true, default: "" },
    appealResolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

SubmissionSchema.index({ campaign: 1, reviewer: 1 }, { unique: true });
// Backs the per-IP daily check — "submissions from this IP since midnight".
SubmissionSchema.index({ submitIp: 1, createdAt: -1 });
// Backs the recheck cron's candidate query — approved submissions that were
// matched on Google, oldest-checked first.
SubmissionSchema.index({ status: 1, gmbMatched: 1, reviewCheckedAt: 1 });

export default mongoose.models.Submission || mongoose.model("Submission", SubmissionSchema);
