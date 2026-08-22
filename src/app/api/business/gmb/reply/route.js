import { z } from "zod";
import dbConnect from "../../../../../lib/db";
import GmbReview from "../../../../../models/GmbReview";
import GmbLocation from "../../../../../models/GmbLocation";
import GmbConnection from "../../../../../models/GmbConnection";
import { apiRequirePermission } from "../../../../../lib/auth/guards";
import { getValidAccessToken, postReviewReply } from "../../../../../lib/gmb";

/**
 * Post the business owner's reply to a Google review. Guarded by
 * review:reply and scoped to the session user via GmbReview.user, so a
 * caller can only reply to their own reviews. Body: { reviewId, comment }
 * where reviewId is the GmbReview document's _id (not Google's review id —
 * that's looked up server-side to avoid trusting a client-supplied Google id).
 */
const schema = z.object({
  reviewId: z.string().min(1),
  comment: z.string().trim().min(1, "Reply can't be empty.").max(4000),
});

export async function POST(request) {
  const { user, response } = await apiRequirePermission("review:reply");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  await dbConnect();

  const review = await GmbReview.findOne({ _id: parsed.data.reviewId, user: user.id });
  if (!review) return Response.json({ error: "Review not found." }, { status: 404 });

  const location = await GmbLocation.findOne({ _id: review.location, user: user.id });
  if (!location) return Response.json({ error: "Location not found." }, { status: 404 });

  const conn = await GmbConnection.findOne({ _id: location.connection, user: user.id, status: "active" }).select(
    "+accessToken +refreshToken"
  );
  if (!conn) return Response.json({ error: "Google account isn't connected." }, { status: 400 });

  let accessToken;
  try {
    accessToken = await getValidAccessToken(conn);
  } catch (e) {
    await GmbConnection.updateOne({ _id: conn._id }, { $set: { status: "error", lastError: e.message.slice(0, 300) } });
    return Response.json({ error: "Reconnect required — token refresh failed." }, { status: 401 });
  }

  try {
    await postReviewReply(accessToken, location.accountName, location.locationName, review.reviewId, parsed.data.comment);
  } catch (e) {
    return Response.json({ error: `Google rejected the reply: ${e.message}` }, { status: 502 });
  }

  review.reply = parsed.data.comment;
  review.updateTime = new Date();
  await review.save();

  return Response.json({ ok: true, reply: review.reply });
}
