"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Trash2, X } from "lucide-react";
import { toast } from "../../lib/toast";

function inr(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

/**
 * Admin-only, permanent delete for ANY campaign (api/admin/campaigns/[id],
 * DELETE) — independent of the business owner's own pause/reopen toggle,
 * which never deletes anything. Confirmed via a real modal (not
 * window.confirm — nothing else in this app uses the native dialog) because
 * this is irreversible: unlike CampaignStatusControl's toggle, there's no
 * "undo" click after this one.
 */
export default function DeleteCampaignButton({ campaignId, campaignName, budget, collected, ratePerReview }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const refund = Math.max(0, (budget ?? 0) - (collected ?? 0) * (ratePerReview ?? 0));

  async function confirmDelete() {
    setPending(true);
    const res = await fetch(`/api/admin/campaigns/${campaignId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setPending(false);

    if (!res.ok) {
      toast.error(data.error ?? "Couldn't delete the campaign.");
      return;
    }

    toast.success(
      data.refunded > 0 ? `Campaign deleted — ${inr(data.refunded)} refunded to the owner's wallet.` : "Campaign deleted."
    );
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Delete this campaign"
        aria-label="Delete this campaign"
        className="inline-flex items-center justify-center rounded-btn border border-default bg-surface p-2 text-muted transition-colors duration-150 hover:border-danger/40 hover:bg-danger-subtle hover:text-danger"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>

      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Delete campaign"
            className="animate-fade-up fixed inset-0 z-50 flex items-center justify-center bg-surface-inverse/60 p-4 backdrop-blur-sm"
            style={{ animationDuration: "200ms" }}
            onClick={() => !pending && setOpen(false)}
          >
            <div
              className="w-full max-w-sm rounded-card border border-default bg-surface-raised p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger-subtle text-danger">
                  <Trash2 className="h-5 w-5" aria-hidden="true" />
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  aria-label="Close"
                  className="shrink-0 rounded-full p-1.5 text-muted transition-all duration-200 hover:scale-110 hover:bg-surface-sunken hover:text-primary disabled:opacity-60"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              <h3 className="mt-3 text-base font-bold text-primary">Delete &ldquo;{campaignName}&rdquo;?</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-secondary">
                This can&apos;t be undone. The campaign disappears from every dashboard immediately.
                {refund > 0 && <> The unspent budget, <span className="font-semibold text-primary">{inr(refund)}</span>, is refunded to the owner&apos;s wallet.</>}
              </p>

              <div className="mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="w-full rounded-btn border border-default bg-surface px-4 py-2.5 text-sm font-semibold text-secondary transition-colors duration-200 hover:bg-surface-sunken disabled:opacity-60 sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={pending}
                  className="flex w-full items-center justify-center gap-2 rounded-btn bg-danger px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:opacity-90 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 sm:w-auto"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  {pending ? "Deleting…" : "Delete campaign"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
