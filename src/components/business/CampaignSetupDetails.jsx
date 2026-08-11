"use client";

import { ImageIcon, MessageSquareText } from "lucide-react";

/**
 * Small pills showing what the owner set up on this campaign at creation —
 * AI-drafted reviews and/or attach-images — with how many are still waiting
 * to be handed to a reviewer vs already claimed. Nothing shows if neither
 * pool was configured. Shared by CampaignsTable (desktop) and CampaignCard
 * (mobile) — see CampaignDetails below for the full expanded content.
 */
export function SetupBadges({ campaign: c }) {
  if (!c.reviewDrafts.length && !c.reviewImages.length) return null;
  const draftsAssigned = c.reviewDrafts.filter((d) => d.assigned).length;
  const imagesAssigned = c.reviewImages.filter((im) => im.assigned).length;
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
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {c.reviewDrafts.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            Reviews &amp; keywords ({c.reviewDrafts.length})
          </p>
          <ul className="mt-2 space-y-2">
            {c.reviewDrafts.map((d, i) => (
              <li key={i} className="rounded-btn border border-default bg-surface p-2.5">
                <div className="flex items-start justify-between gap-2">
                  {d.keyword && (
                    <span className="inline-flex shrink-0 rounded-full bg-accent-subtle px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                      {d.keyword}
                    </span>
                  )}
                  <span
                    className={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
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
                className="group relative aspect-square overflow-hidden rounded-btn border border-default"
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
