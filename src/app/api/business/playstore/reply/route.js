import { z } from "zod";
import dbConnect from "../../../../../lib/db";
import PlayStoreConnection from "../../../../../models/PlayStoreConnection";
import PlayStoreApp from "../../../../../models/PlayStoreApp";
import PlayStoreReview from "../../../../../models/PlayStoreReview";
import { apiRequirePermission } from "../../../../../lib/auth/guards";
import { getValidAccessToken, postReviewReply } from "../../../../../lib/playstore";

/** Post (or overwrite) a developer reply to one review. Body: { reviewId, text }. */
const schema = z.object({ reviewId: z.string().min(1), text: z.string().trim().min(1).max(350) }).strict();

export async function POST(request) {
  const { user, response } = await apiRequirePermission("connection:playstore:manage");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  await dbConnect();

  const review = await PlayStoreReview.findOne({ _id: parsed.data.reviewId, user: user.id });
  if (!review) return Response.json({ error: "Review not found" }, { status: 404 });

  const app = await PlayStoreApp.findOne({ _id: review.app, user: user.id });
  if (!app) return Response.json({ error: "App not found" }, { status: 404 });

  const conn = await PlayStoreConnection.findOne({ _id: review.connection, user: user.id }).select(
    "+accessToken +refreshToken"
  );
  if (!conn) return Response.json({ error: "Connection not found" }, { status: 404 });

  try {
    const accessToken = await getValidAccessToken(conn);
    await postReviewReply(accessToken, app.packageName, review.reviewId, parsed.data.text);
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status ?? 500 });
  }

  review.reply = parsed.data.text;
  review.replyLastModified = new Date();
  await review.save();

  return Response.json({ ok: true });
}
