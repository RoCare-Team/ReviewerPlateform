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
 * Admin-only, permanent user delete (api/admin/users/[id], DELETE).
 * Confirmed via a real modal — same reasoning as DeleteCampaignButton, this
 * is irreversible and there's no undo click after it.
 *
 * The server rejects a business owner with any still-active/paused/draft
 * campaign (delete or let those finish first — see the API route's
 * docblock), and any wallet balance left on the account is simply
 * forfeited on delete, not refunded anywhere — both surfaced here so the
 * admin isn't confirming blind.
 */
export default function DeleteUserButton({ userId, userName, walletBalance }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function confirmDelete() {
    setPending(true);
    const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setPending(false);

    if (!res.ok) {
      toast.error(data.error ?? "Couldn't delete this user.");
      return;
    }

    toast.success("User deleted.");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Delete this user"
        aria-label="Delete this user"
        className="inline-flex items-center justify-center rounded-btn border border-default bg-surface p-2 text-muted transition-colors duration-150 hover:border-danger/40 hover:bg-danger-subtle hover:text-danger"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>

      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Delete user"
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

              <h3 className="mt-3 text-base font-bold text-primary">Delete {userName || "this user"}?</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-secondary">
                This can&apos;t be undone — their account, submissions and campaign history stay queryable
                elsewhere, but they lose access immediately.
                {walletBalance > 0 && (
                  <>
                    {" "}
                    They still have <span className="font-semibold text-primary">{inr(walletBalance)}</span> in
                    their wallet — it is <span className="font-semibold text-danger">not</span> refunded anywhere.
                  </>
                )}
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
                  {pending ? "Deleting…" : "Delete user"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
