import Link from "next/link";
import { CornerDownRight, Star, RefreshCw, MessageSquare } from "lucide-react";
import { requireRole } from "../../../../lib/auth/guards";
import { ROLES } from "../../../../lib/auth/roles";
import dbConnect from "../../../../lib/db";
import GmbReview from "../../../../models/GmbReview";
import GmbLocation from "../../../../models/GmbLocation";
import GmbConnection from "../../../../models/GmbConnection";
import { syncConnectionReviews } from "../../../../lib/gmb";
import SyncReviewsButton from "../../../../components/business/SyncReviewsButton";
import ReplyToReview from "../../../../components/business/ReplyToReview";

// Auto-sync throttle — visiting the page re-fetches from Google at most this
// often per connection, so normal navigation doesn't hammer the GMB API.
const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Best-effort auto-sync: pulls fresh reviews for any active connection that
 * hasn't synced in the last AUTO_SYNC_INTERVAL_MS, so the business owner sees
 * reviews without having to click "Sync reviews" first. Never throws — a
 * failed sync (expired token, API not allowlisted, etc.) just leaves last
 * known data on screen; the manual button and its error message stay the
 * fallback.
 */
async function autoSyncStaleConnections(userId) {
  const connections = await GmbConnection.find({ user: userId, status: "active" }).select("+accessToken +refreshToken");
  if (connections.length === 0) return;

  const cutoff = new Date(Date.now() - AUTO_SYNC_INTERVAL_MS);
  for (const conn of connections) {
    const locations = await GmbLocation.find({ connection: conn._id, user: userId });
    const stale = locations.some((l) => !l.lastSyncedAt || l.lastSyncedAt < cutoff);
    if (!stale || locations.length === 0) continue;

    try {
      const { errors } = await syncConnectionReviews(conn, locations);
      await GmbConnection.updateOne({ _id: conn._id }, { $set: { lastError: errors.join(" | ").slice(0, 300) } });
    } catch {
      // Best-effort — page still renders with whatever's already in the DB.
    }
  }
}

export const metadata = { title: "Reviews · RapportLook Business" };

function Stars({ n }) {
  return (
    <span className="inline-flex" aria-label={`${n} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`h-4 w-4 ${i < n ? "fill-amber-400 text-amber-400" : "text-default"}`} aria-hidden="true" />
      ))}
    </span>
  );
}

export default async function BusinessReviewsPage() {
  const user = await requireRole(ROLES.BUSINESS_OWNER);

  await dbConnect();
  await autoSyncStaleConnections(user.id);

  const [reviews, connections] = await Promise.all([
    GmbReview.find({ user: user.id }).sort({ createTime: -1 }).limit(200).lean(),
    GmbConnection.find({ user: user.id, status: "active" }).select("_id").lean(),
  ]);

  // Map location id → title for a readable label per review.
  const locs = await GmbLocation.find({ user: user.id }).select("title locationName").lean();
  const locTitle = new Map(locs.map((l) => [String(l._id), l.title || l.locationName]));

  const hasConnection = connections.length > 0;
  const connectionIds = connections.map((c) => String(c._id));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Reviews</h1>
          <p className="mt-2 text-secondary">Reviews fetched from your connected Google Business Profile.</p>
        </div>
        {hasConnection && <SyncReviewsButton connectionIds={connectionIds} />}
      </div>

      {!hasConnection ? (
        <div className="mt-8 rounded-card border border-dashed border-default bg-surface-raised p-10 text-center">
          <MessageSquare className="mx-auto h-8 w-8 text-muted" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-primary">No Google account connected</p>
          <p className="mt-1 text-sm text-secondary">Connect your Google Business Profile to fetch reviews.</p>
          <Link
            href="/business/connections"
            className="mt-5 inline-flex items-center gap-2 rounded-btn bg-accent px-4 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition hover:bg-accent-hover"
          >
            Go to Connections
          </Link>
        </div>
      ) : reviews.length === 0 ? (
        <div className="mt-8 rounded-card border border-dashed border-default bg-surface-raised p-10 text-center">
          <RefreshCw className="mx-auto h-8 w-8 text-muted" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-primary">No reviews synced yet</p>
          <p className="mt-1 text-sm text-secondary">
            Click <span className="font-semibold">Sync reviews</span> above to fetch your latest Google reviews.
          </p>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {reviews.map((v) => (
            <li key={String(v._id)} className="rounded-card border border-default bg-surface-raised p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-subtle text-sm font-bold text-accent">
                    {(v.reviewerName || "?").charAt(0)}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-primary">{v.reviewerName || "Anonymous"}</p>
                    <p className="text-xs text-muted">
                      Google
                      {locTitle.get(String(v.location)) ? ` · ${locTitle.get(String(v.location))}` : ""}
                      {v.createTime ? ` · ${new Date(v.createTime).toLocaleDateString("en-IN")}` : ""}
                    </p>
                  </div>
                </div>
                <Stars n={v.starRating} />
              </div>

              {v.comment && <p className="mt-3 text-sm leading-relaxed text-secondary">{v.comment}</p>}

              {v.reply ? (
                <div className="mt-3.5 ml-3 flex gap-2.5 border-l-2 border-accent/30 rounded-l-sm bg-surface-sunken py-3 pl-3.5 pr-4">
                  <CornerDownRight className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-primary">Your reply</p>
                    <p className="mt-1 text-sm leading-relaxed text-secondary">{v.reply}</p>
                  </div>
                </div>
              ) : (
                <ReplyToReview reviewId={String(v._id)} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
