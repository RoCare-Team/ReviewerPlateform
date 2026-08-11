import dbConnect from "../../../../lib/db";
import GmbConnection from "../../../../models/GmbConnection";
import GmbLocation from "../../../../models/GmbLocation";
import GmbReview from "../../../../models/GmbReview";
import { getValidAccessToken, postReviewReply, syncConnectionReviews } from "../../../../lib/gmb";
import { generateReviewReply } from "../../../../lib/aiReply";

/**
 * AI auto-reply for new Google reviews. For every connection with
 * autoReplyEnabled: syncs fresh reviews from Google, then for any review
 * that still has no reply (and wasn't already auto-replied), drafts a reply
 * with OpenAI and posts it back to Google.
 *
 * Meant to be hit by a scheduler every 15 minutes — see vercel.json.
 * Unauthenticated by request, same as gmb-recheck — only ever acts on
 * connections that have autoReplyEnabled turned on, and only replies to
 * reviews that don't already have one, so an extra/spammed call can't post
 * duplicate or unwanted replies.
 */
const CONNECTION_LIMIT = 20; // connections processed per run
const REVIEWS_PER_LOCATION = 10; // freshly-unreplied reviews handled per location per run

export async function GET() {
  await dbConnect();

  const connections = await GmbConnection.find({ status: "active", autoReplyEnabled: true })
    .select("+accessToken +refreshToken")
    .limit(CONNECTION_LIMIT);

  let repliesPosted = 0;
  let skipped = 0;
  const errors = [];

  for (const conn of connections) {
    const locations = await GmbLocation.find({ connection: conn._id, user: conn.user });
    if (locations.length === 0) continue;

    // Pull latest reviews first so brand-new ones are there to reply to.
    const { errors: syncErrors } = await syncConnectionReviews(conn, locations);
    if (syncErrors.length) errors.push(...syncErrors.map((e) => `${conn.googleEmail}: ${e}`));

    let accessToken;
    try {
      accessToken = await getValidAccessToken(conn);
    } catch (e) {
      errors.push(`${conn.googleEmail}: token refresh failed — ${e.message}`);
      continue;
    }

    for (const loc of locations) {
      const pending = await GmbReview.find({
        location: loc._id,
        reply: "",
        autoReplied: false,
      })
        .sort({ createTime: -1 })
        .limit(REVIEWS_PER_LOCATION);

      for (const review of pending) {
        const reply = await generateReviewReply({
          businessName: loc.title || loc.locationName,
          reviewerName: review.reviewerName,
          starRating: review.starRating,
          comment: review.comment,
        });
        if (!reply) {
          skipped += 1;
          continue;
        }

        try {
          await postReviewReply(accessToken, loc.accountName, loc.locationName, review.reviewId, reply);
        } catch (e) {
          errors.push(`${loc.title || loc.locationName}: ${e.message}`);
          continue;
        }

        review.reply = reply;
        review.updateTime = new Date();
        review.autoReplied = true;
        review.autoRepliedAt = new Date();
        await review.save();
        repliesPosted += 1;
      }
    }
  }

  return Response.json({
    ok: true,
    connectionsChecked: connections.length,
    repliesPosted,
    skipped,
    errors: errors.slice(0, 20),
  });
}
