"use client";

import { Clock, ImageIcon, MessageSquareText } from "lucide-react";

/**
 * Small pills showing what the owner set up on this campaign at creation —
 * AI-drafted reviews, attach-images, and/or drip pacing — with how many are
 * still waiting to be handed to a reviewer vs already claimed. Nothing shows
 * if none of these were configured. Shared by CampaignsTable (desktop) and
 * CampaignCard (mobile) — see CampaignDetails below for the full expanded
 * content.
 */
export function SetupBadges({ campaign: c }) {
  const hasPacing = Boolean(c.pacingLimit && c.pacingWindowHours);
  if (!c.reviewDrafts.length && !c.reviewImages.length && !hasPacing) return null;
  const draftsAssigned = c.reviewDrafts.filter((d) => d.assigned).length;
  const imagesAssigned = c.reviewImages.filter((im) => im.assigned).length;
  const pacingDays = hasPacing ? c.pacingWindowHours / 24 : 0;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      {c.reviewDrafts.length > 0 && (
        <span
          title={`${draftsAssigned} of ${c.reviewDrafts.length} reviews handed to reviewers`}
          className="inline-flex items-center gap-1 rounded-full bg-accent-subtle px-1.5 py-0.5 text-[10px] font-semibold text-accent"
        >
          <MessageSquareText className="h-2.5 w-2.5" aria-hidden="true" />
          {draftsAssigned}/{c.reviewDrafts.length} reviews
        </span>
      )}
      {c.reviewImages.length > 0 && (
        <span
          title={`${imagesAssigned} of ${c.reviewImages.length} images handed to reviewers`}
          className="inline-flex items-center gap-1 rounded-full bg-accent-subtle px-1.5 py-0.5 text-[10px] font-semibold text-accent"
        >
          <ImageIcon className="h-2.5 w-2.5" aria-hidden="true" />
          {imagesAssigned}/{c.reviewImages.length} images
        </span>
      )}
      {hasPacing && (
        <span
          title="Reviews are paced out so they don't land on Google all at once"
          className="inline-flex items-center gap-1 rounded-full bg-accent-subtle px-1.5 py-0.5 text-[10px] font-semibold text-accent"
        >
          <Clock className="h-2.5 w-2.5" aria-hidden="true" />
          {c.pacingLimit}/{pacingDays === 1 ? "day" : `${pacingDays}d`}
        </span>
      )}
    </div>
  );
}

/**
 * Full content of a campaign's review-draft/image pools — every keyword,
 * every generated review, every image, with an "assigned" flag on each so
 * the owner can see exactly what's already gone out to a reviewer vs what's
 * still waiting.
 */
export function CampaignDetails({ campaign: c }) {
  if (c.reviewDrafts.length === 0 && c.reviewImages.length === 0) {
    return <p className="text-xs text-muted">No AI-drafted reviews or images were set up on this campaign.</p>;
  }
  const hasBoth = c.reviewDrafts.length > 0 && c.reviewImages.length > 0;

  return (
    <div className={`grid gap-5 ${hasBoth ? "sm:grid-cols-2" : ""}`}>
      {c.reviewDrafts.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            Reviews &amp; keywords ({c.reviewDrafts.length})
          </p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {c.reviewDrafts.map((d, i) => (
              // rounded-xl, not rounded-btn — rounded-btn is the 9999px pill
              // radius meant for actual buttons; on a multi-line text block
              // it stretched into an oval/stadium shape instead of a card.
              <li key={i} className="rounded-xl border border-default bg-surface p-3">
                <div className="flex items-center justify-between gap-2">
                  {d.keyword ? (
                    <span className="inline-flex shrink-0 rounded-full bg-accent-subtle px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                      {d.keyword}
                    </span>
                  ) : (
                    <span />
                  )}
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      d.assigned ? "bg-verified-subtle text-verified" : "bg-surface-sunken text-muted"
                    }`}
                  >
                    {d.assigned ? "Given to a reviewer" : "Available"}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-secondary">{d.text}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {c.reviewImages.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Images ({c.reviewImages.length})</p>
          <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-5">
            {c.reviewImages.map((im, i) => (
              <a
                key={i}
                href={im.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative aspect-square overflow-hidden rounded-lg border border-default"
                title={im.assigned ? "Given to a reviewer" : "Available"}
              >
                <img src={im.url} alt="" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105" />
                {im.assigned && (
                  <span className="absolute inset-x-0 bottom-0 bg-verified/90 px-1 py-0.5 text-center text-[9px] font-bold uppercase tracking-wide text-white">
                    Given
                  </span>
                )}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
