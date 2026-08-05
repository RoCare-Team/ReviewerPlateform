"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Globe2,
  IndianRupee,
  Link2,
  MapPin,
  MessageSquareText,
  Plus,
  Sparkles,
  Star,
  Tag,
  Wallet,
  X,
} from "lucide-react";
import { approxReviews, inr } from "../../lib/campaigns";
import { Label, Input, FormError } from "../auth/Field";
import Toast from "../shared/Toast";

const selectClass =
  "w-full appearance-none rounded-btn border border-default bg-surface py-2.5 pl-10 pr-3 text-primary outline-none transition-all duration-200 hover:border-strong focus:border-accent focus:ring-2 focus:ring-accent/50";

/**
 * Create-campaign modal. Shows a live "approx reviews" preview from the budget
 * at the admin-controlled ₹/review rate, and blocks submit when the budget
 * exceeds the wallet balance. Posts to /api/business/campaigns which debits
 * the wallet.
 */
export default function NewCampaignModal({ walletBalance, locations = [], rate = 100 }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({ name: "", platform: "google", budget: "", notes: "", locationId: "", targetUrl: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const budgetNum = Number(values.budget) || 0;
  const reviews = approxReviews(budgetNum, rate);
  const overBudget = budgetNum > walletBalance;
  const selectedLocation = locations.find((l) => l.id === values.locationId);
  const autoFilledUrl =
    values.platform === "google" &&
    Boolean(selectedLocation?.reviewUrl) &&
    values.targetUrl === selectedLocation.reviewUrl;

  function set(key) {
    return (e) => {
      let value = e.target.value;
      // Budget can't even be TYPED past the wallet balance — clamp it live
      // instead of only catching it on submit, and say why with a toast.
      if (key === "budget" && value !== "") {
        const n = Number(value);
        if (!Number.isNaN(n) && n > walletBalance) {
          value = String(walletBalance);
          setToast("You don't have enough funds in your wallet. Add funds to increase your budget.");
        }
      }

      setValues((v) => {
        const next = { ...v, [key]: value };

        // Only Google locations carry a real "write a review" link (synced
        // from the connected GMB account) — auto-fill the review URL from
        // whichever location ends up selected, but only for Google. Picking
        // any other platform, or a location with no saved link, leaves the
        // field as-is so the owner can paste one manually.
        if (key === "platform" || key === "locationId") {
          const loc = locations.find((l) => l.id === next.locationId);
          if (next.platform === "google" && loc?.reviewUrl) {
            next.targetUrl = loc.reviewUrl;
          }
        }

        return next;
      });
    };
  }

  function close() {
    setOpen(false);
    setError("");
  }

  // Escape closes the modal; background scroll is locked while it's open —
  // same behaviour as the app's other modals (ContactModal, ScreenshotViewer).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") close();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (!values.name.trim()) return setError("Give your campaign a name.");
    if (!values.targetUrl.trim()) return setError("Add the review URL where customers should leave a review.");
    if (budgetNum < rate) return setError(`Minimum budget is ${inr(rate)} (one review).`);
    if (overBudget) {
      setToast("You don't have enough funds in your wallet. Add funds to increase your budget.");
      return;
    }

    setPending(true);
    const res = await fetch("/api/business/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: values.name.trim(),
        platform: values.platform,
        budget: Math.floor(budgetNum),
        notes: values.notes.trim(),
        targetUrl: values.targetUrl.trim(),
        locationId: values.locationId || undefined,
      }),
    });
    setPending(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // The API's own insufficient-balance message is a race-safety net (the
      // wallet could have been spent elsewhere between page load and submit)
      // — still surfaced as the same toast, not a generic inline error.
      if (/insufficient/i.test(data.error ?? "")) {
        setToast("You don't have enough funds in your wallet. Add funds to increase your budget.");
        return;
      }
      return setError(data.error ?? "Couldn't create the campaign.");
    }

    setValues({ name: "", platform: "google", budget: "", notes: "", locationId: "", targetUrl: "" });
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-btn bg-accent px-4 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-md"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        New campaign
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="New campaign"
          className="animate-fade-up fixed inset-0 z-50 flex items-center justify-center bg-surface-inverse/60 p-4 backdrop-blur-sm"
          style={{ animationDuration: "200ms" }}
          onClick={close}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-card border border-default bg-surface-raised shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header — sticky, stays put while the form body scrolls */}
            <div className="flex shrink-0 items-center justify-between border-b border-default px-6 py-4 sm:px-8">
              <div>
                <h2 className="text-lg font-bold text-primary">New campaign</h2>
                <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-secondary">
                  <Wallet className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                  Wallet: <span className="font-bold text-primary">{inr(walletBalance)}</span>
                  <Link href="/business/settings" className="font-semibold text-accent hover:underline">
                    Add funds
                  </Link>
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="shrink-0 rounded-full p-1.5 text-muted transition-all duration-200 hover:scale-110 hover:bg-surface-sunken hover:text-primary"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* Body — the only part that scrolls */}
            <form id="new-campaign-form" onSubmit={onSubmit} className="min-h-0 flex-1 overflow-y-auto px-6 py-5 sm:px-8">
              <Toast message={toast} tone="error" onClose={() => setToast("")} />
              <FormError>{error}</FormError>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="c-name">Campaign name</Label>
                  <Input
                    id="c-name"
                    value={values.name}
                    onChange={set("name")}
                    placeholder="Summer Google reviews"
                    icon={Tag}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="c-platform">Platform</Label>
                    <div className="group relative">
                      <Globe2
                        className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted transition-colors duration-200 group-focus-within:text-accent"
                        aria-hidden="true"
                      />
                      <select id="c-platform" value={values.platform} onChange={set("platform")} className={selectClass}>
                        <option value="google">Google</option>
                        <option value="trustpilot">Trustpilot</option>
                        <option value="capterra">Capterra</option>
                        <option value="amazon">Amazon</option>
                        <option value="playstore">Play Store</option>
                      </select>
                    </div>
                  </div>

                  {locations.length > 0 && (
                    <div>
                      <Label htmlFor="c-loc">Location (optional)</Label>
                      <div className="group relative">
                        <MapPin
                          className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted transition-colors duration-200 group-focus-within:text-accent"
                          aria-hidden="true"
                        />
                        <select id="c-loc" value={values.locationId} onChange={set("locationId")} className={selectClass}>
                          <option value="">All locations</option>
                          {locations.map((l) => (
                            <option key={l.id} value={l.id}>{l.title}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="c-url">Review URL</Label>
                  <Input
                    id="c-url"
                    type="url"
                    inputMode="url"
                    value={values.targetUrl}
                    onChange={set("targetUrl")}
                    placeholder="https://g.page/r/your-business/review"
                    icon={Link2}
                  />
                  {autoFilledUrl ? (
                    <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-verified">
                      <Sparkles className="h-3 w-3" aria-hidden="true" />
                      Auto-filled from your connected Google location — edit it if this isn&apos;t right.
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs text-muted">The link where reviewers should leave their review (e.g. your Google review link).</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="c-budget">Budget (₹)</Label>
                  <Input
                    id="c-budget"
                    type="number"
                    min={rate}
                    max={walletBalance}
                    step="100"
                    inputMode="numeric"
                    value={values.budget}
                    onChange={set("budget")}
                    placeholder="10000"
                    icon={IndianRupee}
                    error={overBudget}
                  />
                  <p className="mt-1.5 text-xs text-muted">Flat rate {inr(rate)} per verified review.</p>
                </div>

                {/* Live estimate */}
                <div className="rounded-btn border border-accent-border bg-accent-subtle px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
                      <Star className="h-4 w-4 fill-accent text-accent" aria-hidden="true" />
                      You&apos;ll get approximately
                    </span>
                    <span className="text-2xl font-extrabold tracking-tight text-primary">{reviews} reviews</span>
                  </div>
                  <p className="mt-1 text-xs text-secondary">
                    {inr(budgetNum)} ÷ {inr(rate)} per review
                  </p>
                </div>

                <div>
                  <Label htmlFor="c-notes">What do you need? (optional)</Label>
                  <div className="group relative">
                    <MessageSquareText
                      className="pointer-events-none absolute left-3 top-3 h-4.5 w-4.5 text-muted transition-colors duration-200 group-focus-within:text-accent"
                      aria-hidden="true"
                    />
                    <textarea
                      id="c-notes"
                      rows={3}
                      value={values.notes}
                      onChange={set("notes")}
                      maxLength={500}
                      placeholder="e.g. Focus on our new outlet, verified customers only, target a 4.5+ average."
                      className="w-full resize-none rounded-btn border border-default bg-surface py-2.5 pl-10 pr-3 text-primary outline-none transition-all duration-200 placeholder:text-muted/70 hover:border-strong focus:border-accent focus:ring-2 focus:ring-accent/50"
                    />
                  </div>
                </div>
              </div>
            </form>

            {/* Footer — sticky, buttons grouped on the right (Cancel, then the primary action) */}
            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-default px-6 py-4 sm:px-8">
              <button
                type="button"
                onClick={close}
                className="rounded-btn border border-default bg-surface px-4 py-2.5 text-sm font-semibold text-secondary transition-colors duration-200 hover:bg-surface-sunken"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="new-campaign-form"
                disabled={pending || overBudget}
                className="rounded-btn bg-accent px-5 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {pending ? "Creating…" : `Start campaign · ${inr(budgetNum)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
