import Link from "next/link";
import { Star, Reply, RefreshCw, MessageSquare } from "lucide-react";
import { requireRole } from "../../../../lib/auth/guards";
import { ROLES } from "../../../../lib/auth/roles";
import dbConnect from "../../../../lib/db";
import GmbReview from "../../../../models/GmbReview";
import GmbLocation from "../../../../models/GmbLocation";
import GmbConnection from "../../../../models/GmbConnection";
import SyncReviewsButton from "../../../../components/business/SyncReviewsButton";

export const metadata = { title: "Reviews · ReviewHub Business" };

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
                <div className="mt-3 rounded-btn border border-default bg-surface-sunken p-3">
                  <p className="text-xs font-semibold text-muted">Your reply</p>
                  <p className="mt-1 text-sm text-secondary">{v.reply}</p>
                </div>
              ) : (
                <div className="mt-4">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-btn border border-default bg-surface px-3 py-1.5 text-sm font-semibold text-primary transition hover:bg-surface-sunken"
                  >
                    <Reply className="h-4 w-4" aria-hidden="true" />
                    Reply
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
