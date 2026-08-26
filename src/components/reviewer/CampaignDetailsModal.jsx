"use client";

import { createPortal } from "react-dom";
import { Building2, Clock, MapPin, Megaphone, RotateCcw, Star, Ticket, X } from "lucide-react";

function inr(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

/**
 * "View campaign" popup — a non-committal full-detail look before booking a
 * slot. Reserving (claimAndOpen) only ever happens from the "Book slot"
 * button, both here and on the card itself; opening this never touches the
 * server. Same overlay/header/body/footer shape as the business-side modals
 * (EditCampaignModal etc.) for visual consistency, sized down since this has
 * no form — just information.
 */
/**
 * `blockedReason` — set when booking is locked for a reason that isn't "a
 * request is in flight" (today: the platform-wide reviewer cooldown). It both
 * disables the button and becomes its label, so the modal never says
 * "Booking…" for something that isn't being booked.
 */
export default function CampaignDetailsModal({ campaign, onClose, onBook, claiming, blockedReason = "" }) {
  const pct = campaign.target ? Math.min(100, Math.round((campaign.collected / campaign.target) * 100)) : 0;

  // Portaled straight to <body> — rendered in place, this sits inside a card
  // that has its own animation/hover transform, and ANY transformed ancestor
  // turns `position: fixed` into "fixed relative to that ancestor" instead of
  // the viewport, which is exactly what was pinning this to the card instead
  // of centering on the page.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${campaign.name} — campaign details`}
      className="animate-fade-up fixed inset-0 z-50 flex items-center justify-center bg-surface-inverse/60 p-4 backdrop-blur-sm"
      style={{ animationDuration: "200ms" }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-card border border-default bg-surface-raised shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — sticky, stays put while the body scrolls */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-default px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-subtle text-accent">
              <Megaphone className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-primary">{campaign.name}</h2>
              {campaign.businessName && (
                <p className="mt-0.5 flex min-w-0 items-center gap-1 text-sm font-semibold text-secondary">
                  <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 truncate">{campaign.businessName}</span>
                </p>
              )}
              <p className="mt-0.5 text-xs font-medium capitalize text-muted">
                {campaign.platform}
                {campaign.businessCategory && <span> · {campaign.businessCategory}</span>}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full p-1.5 text-muted transition-all duration-200 hover:scale-110 hover:bg-surface-sunken hover:text-primary"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Body — the only part that scrolls */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-verified-subtle px-2.5 py-1 text-xs font-bold text-verified">
              <Star className="h-3.5 w-3.5 fill-verified text-verified" aria-hidden="true" />
              Earn {inr(campaign.reward)}
            </span>
            {campaign.cities?.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-medium text-secondary">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                {campaign.cities.join(", ")}
              </span>
            )}
          </div>

          {campaign.previouslyRejected && (
            <p className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-danger-subtle px-2.5 py-1 text-xs font-semibold text-danger">
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              Previously rejected — try again with a new screenshot
            </p>
          )}

          {campaign.notes && (
            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">About this campaign</p>
              <p className="mt-1.5 text-sm leading-relaxed text-secondary">{campaign.notes}</p>
            </div>
          )}

          {/* Progress — spots left toward the campaign target */}
          {typeof campaign.target === "number" && (
            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Progress</p>
              <div className="mt-1.5 flex items-center justify-between text-xs font-medium text-secondary">
                <span className="nums">{campaign.collected} / {campaign.target} collected</span>
                <span className="nums font-bold text-accent">{campaign.remaining} spots left</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-sunken">
                <div className="h-full rounded-full bg-accent transition-all duration-700 ease-out" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}

          <div className="mt-4 rounded-card border border-default bg-surface p-3.5">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">How it works</p>
            <ol className="mt-2 space-y-1.5 text-xs leading-relaxed text-secondary">
              <li className="flex gap-1.5"><span className="font-bold text-accent">1.</span> Book your slot — this reserves it and gets a ready-to-copy review/photo prepared for you.</li>
              <li className="flex gap-1.5"><span className="font-bold text-accent">2.</span> Post the review on {campaign.platform} using what was prepared.</li>
              <li className="flex gap-1.5"><span className="font-bold text-accent">3.</span> Upload a screenshot as proof — verified instantly, reward credited right after.</li>
            </ol>
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-muted">
              <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
              Your slot holds for a limited window once booked — don&apos;t book until you&apos;re ready to post.
            </p>
          </div>
        </div>

        {/* Footer — sticky */}
        <div className="flex shrink-0 flex-col-reverse gap-2.5 border-t border-default px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-btn border border-default bg-surface px-4 py-2.5 text-sm font-semibold text-secondary transition-colors duration-200 hover:bg-surface-sunken sm:w-auto"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onBook}
            disabled={claiming || Boolean(blockedReason)}
            title={blockedReason || undefined}
            className="flex w-full items-center justify-center gap-2 rounded-btn bg-accent px-5 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 sm:w-auto"
          >
            <Ticket className="h-4 w-4" aria-hidden="true" />
            {blockedReason ? "On cooldown" : claiming ? "Booking…" : campaign.previouslyRejected ? "Resubmit" : "Book slot"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
