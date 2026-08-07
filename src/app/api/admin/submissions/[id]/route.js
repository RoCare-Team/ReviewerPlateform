import { z } from "zod";
import dbConnect from "../../../../../lib/db";
import Submission from "../../../../../models/Submission";
import { getCurrentUser } from "../../../../../lib/auth/session";
import { ROLES } from "../../../../../lib/auth/roles";
import { getSettings } from "../../../../../lib/settings";
import { approveSubmission, unverifySubmission } from "../../../../../lib/verification";

/**
 * Admin verifies a reviewer's submission.
 *   approve → credit the reviewer's wallet with the global reward, bump the
 *             campaign's collected count (complete it if the target is hit).
 *             Allowed from "pending" (the normal case) OR "rejected" — an
 *             admin can override an earlier rejection (their own or the
 *             AI's) and pay it after all. Only ever admin-initiated; nothing
 *             else in the app can flip a rejected submission to approved.
 *   reject  → mark rejected with a reason. No reward. Only from "pending".
 *   unverify → reverse an earlier APPROVED verdict (AI's or another admin's).
 *             Claws back the reward from the reviewer's wallet, gives the
 *             campaign slot back, flips status to "rejected". Requires a
 *             reason, same as reject.
 *
 * The status guard makes all three actions idempotent — approving/rejecting
 * an already-approved submission, or unverifying a non-approved one, matches
 * nothing, so a reviewer can never be double-paid or clawed back twice.
 */
const schema = z
  .object({
    action: z.enum(["approve", "reject", "unverify"]),
    reason: z.string().trim().max(300).optional().default(""),
  })
  .strict();

async function requireAdminApi() {
  const user = await getCurrentUser();
  if (!user || user.role !== ROLES.ADMIN || user.status !== "active") {
    return { user: null, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user, response: null };
}

export async function PATCH(request, { params }) {
  const { user: admin, response } = await requireAdminApi();
  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  // A rejection or unverify must carry a reason — the reviewer is shown why.
  if ((parsed.data.action === "reject" || parsed.data.action === "unverify") && !parsed.data.reason.trim()) {
    const verb = parsed.data.action === "reject" ? "reject" : "un-verify";
    return Response.json({ error: `A reason is required to ${verb} a submission.` }, { status: 400 });
  }

  await dbConnect();

  if (parsed.data.action === "reject") {
    const rejected = await Submission.findOneAndUpdate(
      { _id: id, status: "pending" },
      { $set: { status: "rejected", rejectionReason: parsed.data.reason, reviewedBy: admin.id, reviewedAt: new Date() } },
      { returnDocument: "after" }
    );
    if (!rejected) return Response.json({ error: "Submission not found or already reviewed." }, { status: 404 });
    return Response.json({ ok: true });
  }

  if (parsed.data.action === "unverify") {
    const outcome = await unverifySubmission(id, parsed.data.reason, { reviewedBy: admin.id });
    if (outcome === "already_processed") {
      return Response.json({ error: "Submission not found or not currently approved." }, { status: 404 });
    }
    if (outcome === "insufficient_balance") {
      return Response.json({
        ok: true,
        warning: "Reward reversed, but the reviewer's wallet balance went negative (likely already withdrawn).",
      });
    }
    return Response.json({ ok: true });
  }

  // Approve — from "pending" normally, or "rejected" when the admin is
  // deliberately overriding an earlier rejection. Existence check up front so
  // a stale/unknown id gives the same 404 admins already expect;
  // approveSubmission itself re-checks the status atomically and also claims
  // the campaign's collected slot atomically, so it can never push collected
  // past targetReviews under concurrent approvals.
  const allowFrom = ["pending", "rejected"];
  const exists = await Submission.exists({ _id: id, status: { $in: allowFrom } });
  if (!exists) return Response.json({ error: "Submission not found or already approved." }, { status: 404 });

  const settings = await getSettings();
  const outcome = await approveSubmission(id, settings.reviewerReward, {
    verifiedBy: "admin",
    reviewedBy: admin.id,
    allowFrom,
  });

  if (outcome === "campaign_full") {
    return Response.json(
      { error: "Campaign already reached its review target — submission rejected, no reward." },
      { status: 409 }
    );
  }
  if (outcome === "already_processed") {
    return Response.json({ error: "Submission not found or already reviewed." }, { status: 404 });
  }

  return Response.json({ ok: true });
}
