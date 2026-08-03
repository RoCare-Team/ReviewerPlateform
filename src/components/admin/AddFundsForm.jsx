"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Loader2, Plus, Wallet, X } from "lucide-react";

/**
 * Admin control to credit a business owner's wallet, in a modal dialog.
 *
 * Built on the native <dialog> element via showModal(): focus trapping, Esc to
 * close, inertness of the page behind it and the ::backdrop all come from the
 * platform. A hand-rolled div overlay gets those wrong far more often than not.
 *
 * The server is the authority — it re-checks the admin session, that the target
 * is an active business owner, and the amount bounds. Nothing here is a
 * security control; it is just the form.
 */
const QUICK = [500, 1000, 5000];

export default function AddFundsForm({ businessId, businessName, walletDisplay }) {
  const router = useRouter();
  const dialogRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  // showModal() must be called imperatively — the `open` attribute alone gives a
  // non-modal dialog with no backdrop and no focus trap.
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  function openModal() {
    setAmount("");
    setNote("");
    setError("");
    setDone("");
    setOpen(true);
  }

  // Esc and backdrop dismissal fire the dialog's own `close` event, not our
  // click handlers — this keeps React state in sync when that happens.
  function onClose() {
    setOpen(false);
    setPending(false);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setDone("");

    const value = Number(amount);
    if (!Number.isInteger(value) || value <= 0) {
      setError("Enter a whole amount in rupees, ₹1 or more.");
      return;
    }

    setPending(true);
    const res = await fetch(`/api/admin/users/${businessId}/wallet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: value, note: note.trim() || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);

    if (!res.ok) {
      setError(data.error ?? "Could not add funds. Try again.");
      return;
    }

    setDone(
      `Added. New balance ₹${Number(data.balance ?? 0).toLocaleString("en-IN")}`
    );
    setAmount("");
    setNote("");

    // Re-render the server component so the row's wallet figure is the DB's
    // number, not one this component guessed.
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="inline-flex items-center gap-1.5 rounded-btn border border-strong bg-surface px-3 py-1.5 text-xs font-semibold text-primary transition-all duration-200 hover:border-accent hover:bg-accent-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Plus className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
        Add funds
      </button>

      <dialog
        ref={dialogRef}
        onClose={onClose}
        // Clicking the backdrop lands on the <dialog> itself, never on its
        // content — so this closes on backdrop click without a second overlay.
        onClick={(e) => {
          if (e.target === dialogRef.current) setOpen(false);
        }}
        aria-labelledby={`funds-title-${businessId}`}
        // `m-auto` is not decoration: the browser centres a modal <dialog> with
        // its UA `margin: auto`, and Tailwind's reset zeroes that on every
        // element — without this the panel sticks to the top-left.
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-card border border-default bg-surface-raised p-0 text-primary shadow-2xl backdrop:bg-surface-inverse/50 backdrop:backdrop-blur-sm open:animate-fade-up"
      >
        <form onSubmit={onSubmit}>
          <div className="flex items-start justify-between gap-4 border-b border-default p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-subtle text-accent">
                <Wallet className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 id={`funds-title-${businessId}`} className="font-bold text-primary">
                  Add funds
                </h2>
                <p className="truncate text-xs text-muted">
                  {businessName}
                  {walletDisplay ? ` · balance ${walletDisplay}` : ""}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded-btn p-1 text-muted transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="p-5">
            <div className="flex flex-wrap gap-2">
              {QUICK.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAmount(String(q))}
                  className={`nums rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-200 ${
                    amount === String(q)
                      ? "border-transparent bg-accent text-on-brand"
                      : "border-default bg-surface text-secondary hover:border-accent/50 hover:text-primary"
                  }`}
                >
                  ₹{q.toLocaleString("en-IN")}
                </button>
              ))}
            </div>

            <div className="mt-4">
              <label
                htmlFor={`amount-${businessId}`}
                className="mb-1.5 block text-sm font-medium text-primary"
              >
                Amount (₹)
              </label>
              <input
                id={`amount-${businessId}`}
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1000"
                required
                className="nums w-full rounded-btn border border-default bg-surface px-3 py-2.5 text-primary outline-none transition-all duration-200 placeholder:text-muted/70 hover:border-strong focus:border-accent focus:ring-2 focus:ring-accent/50"
              />
            </div>

            <div className="mt-4">
              <label
                htmlFor={`note-${businessId}`}
                className="mb-1.5 block text-sm font-medium text-primary"
              >
                Note <span className="font-normal text-muted">(optional)</span>
              </label>
              <input
                id={`note-${businessId}`}
                type="text"
                maxLength={200}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Bank transfer ref, refund reason…"
                className="w-full rounded-btn border border-default bg-surface px-3 py-2.5 text-primary outline-none transition-all duration-200 placeholder:text-muted/70 hover:border-strong focus:border-accent focus:ring-2 focus:ring-accent/50"
              />
            </div>

            {done ? (
              <p
                role="status"
                className="mt-4 flex items-start gap-2 rounded-btn border border-verified/40 bg-verified-subtle px-3 py-2.5 text-sm font-semibold text-verified"
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{done}</span>
              </p>
            ) : null}

            {error ? (
              <p
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-btn border border-danger bg-danger-subtle px-3 py-2.5 text-sm text-danger"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </p>
            ) : null}

            {/* Kept to one line: credits are irreversible here, and that is the
                only thing an admin needs to know before clicking. */}
            <p className="mt-4 text-xs text-muted">Credited instantly. Cannot be undone.</p>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-default bg-surface-sunken/50 p-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-btn border border-strong bg-surface px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {done ? "Done" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center justify-center rounded-btn bg-accent px-4 py-2 text-sm font-semibold text-on-brand shadow-sm transition-all duration-200 hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Adding…
                </>
              ) : (
                "Add funds"
              )}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
