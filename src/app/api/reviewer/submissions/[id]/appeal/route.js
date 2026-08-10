import { z } from "zod";
import dbConnect from "../../../../../../lib/db";
import Submission from "../../../../../../models/Submission";
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

  return Response.json({ ok: true });
}
