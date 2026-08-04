import { z } from "zod";
import dbConnect from "../../../../../lib/db";
import Submission from "../../../../../models/Submission";
import { getCurrentUser } from "../../../../../lib/auth/session";
import { ROLES } from "../../../../../lib/auth/roles";
import { getSettings } from "../../../../../lib/settings";
import { approveSubmission } from "../../../../../lib/verification";

/**
 * Admin verifies a reviewer's submission.
 *   approve → credit the reviewer's wallet with the global reward, bump the
 *             campaign's collected count (complete it if the target is hit).
 *   reject  → mark rejected with a reason. No reward.
 *
 * The status guard ({ status: "pending" }) makes approve idempotent — a second
 * click matches nothing, so a reviewer can never be double-paid.
 */
const schema = z
  .object({
    action: z.enum(["approve", "reject"]),
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

  // Approve. Existence check up front so a stale/unknown id gives the same
  // 404 admins already expect; approveSubmission itself re-checks "pending"
  // atomically and also claims the campaign's collected slot atomically, so
  // it can never push collected past targetReviews under concurrent approvals.
  const exists = await Submission.exists({ _id: id, status: "pending" });
  if (!exists) return Response.json({ error: "Submission not found or already reviewed." }, { status: 404 });

  const settings = await getSettings();
  const outcome = await approveSubmission(id, settings.reviewerReward, { reviewedBy: admin.id });

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
