import { z } from "zod";
import dbConnect from "../../../../../../lib/db";
import Submission from "../../../../../../models/Submission";
import Campaign from "../../../../../../models/Campaign";
import { apiRequirePermission } from "../../../../../../lib/auth/guards";

/**
 * Reviewer disputes a final rejection — "the same screenshot was right,
 * please have a human look again", as opposed to resubmitting with a new
 * screenshot (still available separately, for when there's genuinely new
 * proof). Only allowed on the reviewer's OWN rejected submission, and only
 * one outstanding appeal at a time — a second appeal can't be filed while
 * one is still `pending`, so this can't be used to spam the queue.
 *
 * Sets appealStatus: "pending", which surfaces the message to admins in
 * VerificationQueue. An admin resolves it either by approving the
 * submission anyway, or by explicitly dismissing the appeal with a reason
 * (see api/admin/submissions/[id] — both flip appealStatus to "resolved").
 */
const schema = z
  .object({
    message: z.string().trim().min(10, "Explain why in a bit more detail.").max(500),
  })
  .strict();

export async function POST(request, { params }) {
  const { user, response } = await apiRequirePermission("feedback:submit");
  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  await dbConnect();

  const submission = await Submission.findOneAndUpdate(
    {
      _id: id,
      reviewer: user.id,
      status: "rejected",
      appealStatus: { $ne: "pending" },
    },
    {
      $set: {
        appealStatus: "pending",
        appealMessage: parsed.data.message,
        appealedAt: new Date(),
        appealResponse: "",
        appealResolvedAt: null,
      },
    },
    { returnDocument: "after" }
  );

  if (!submission) {
    return Response.json(
      { error: "This submission can't be appealed right now — it may already have an appeal pending, or isn't rejected." },
      { status: 409 }
    );
  }

  // The updated row goes back in the SAME flattened shape GET
  // /api/reviewer/submissions returns, so the mobile client can drop it
  // straight into its list without a refetch. The web form ignores the body
  // and calls router.refresh() instead — both stay correct.
  const campaign = await Campaign.findById(submission.campaign)
    .select("name platform businessName businessCategory city cities")
    .lean();

  return Response.json({
    ok: true,
    submission: {
      id: String(submission._id),
      campaignId: String(submission.campaign),
      campaignName: campaign?.name ?? "Campaign",
      platform: campaign?.platform ?? "google",
      businessName: campaign?.businessName ?? "",
      businessCategory: campaign?.businessCategory ?? "",
      city: campaign?.cities?.[0] ?? campaign?.city ?? "",
      status: submission.status,
      rewardAmount: submission.rewardAmount ?? 0,
      screenshotUrl: submission.screenshotUrl ?? "",
      note: submission.note ?? "",
      rejectionReason: submission.rejectionReason ?? "",
      appealStatus: submission.appealStatus ?? "none",
      appealMessage: submission.appealMessage ?? "",
      appealResponse: submission.appealResponse ?? "",
      submittedAt: submission.createdAt,
      reviewedAt: submission.reviewedAt,
    },
  });
}
