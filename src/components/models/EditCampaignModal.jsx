"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Globe2, IndianRupee, Link2, MapPinned, Pencil, Star, Tag, Target, Wallet, X } from "lucide-react";
import { Label, Input, FormError } from "../auth/Field";
import CityMultiSelect from "../business/CityMultiSelect";
import { inr, campaignCities } from "../../lib/campaigns";
import { toast } from "../../lib/toast";

const PLATFORM_LABEL = { google: "Google", trustpilot: "Trustpilot", capterra: "Capterra", amazon: "Amazon", playstore: "Play Store" };
const selectClass =
  "w-full appearance-none rounded-btn border border-default bg-surface py-2.5 pl-10 pr-3 text-primary outline-none transition-all duration-200 hover:border-strong focus:border-accent focus:ring-2 focus:ring-accent/50";

/**
 * Edit an existing campaign — everything that was entered at creation is
 * prefilled and updatable: name, review URL, state/city, location, notes,
 * and the target review count (which re-prices the campaign at its
 * EXISTING rate and debits/refunds the wallet for the difference server-side
 * — see the PATCH route this posts to). Deliberately locked: platform
 * (reviewer-side matching differs per platform) and the ₹/review rate
 * itself (admin-controlled) — shown read-only so nothing feels hidden.
 * Same modal chrome as NewCampaignModal for visual consistency.
 */
export default function EditCampaignModal({ campaign, locations = [], walletBalance = 0, trigger }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const isGoogle = campaign.platform === "google";
  // Reopening this campaign's own location shouldn't feel "used up" by
  // itself — only OTHER campaigns' locations are excluded implicitly here
  // since this is a single-location picker, not the multi-row create form.
  const rate = campaign.ratePerReview || 1;
  // Reducing back down frees up what this campaign already holds, so the
  // ceiling is the wallet PLUS what's already committed here, not just the
  // raw wallet balance.
  const maxReviews = Math.floor((walletBalance + campaign.budget) / rate);
  const minReviews = Math.max(1, campaign.collected || 0);

  function initialValues() {
    const cities = campaignCities(campaign);
    return {
      name: campaign.name || "",
      notes: campaign.notes || "",
      targetUrl: campaign.targetUrl || "",
      cities,
      // Mirrors NewCampaignModal's All India / Preferred city tabs — an
      // existing campaign with no cities set is already open to everyone,
      // so it opens on the All India tab; one with cities set opens on
      // Preferred with them prefilled.
      cityMode: cities.length > 0 ? "preferred" : "all_india",
      locationId: campaign.location || "",
      reviews: String(campaign.targetReviews ?? 0),
    };
  }

  const [values, setValues] = useState(initialValues);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const reviewsNum = Number(values.reviews) || 0;
  const newBudget = reviewsNum * rate;
  const overBudget = reviewsNum > maxReviews;

  function set(key) {
    return (e) => setValues((v) => ({ ...v, [key]: e.target.value }));
  }

  function setReviews(e) {
    let value = e.target.value;
    if (value !== "") {
      const n = Number(value);
      if (!Number.isNaN(n) && n > maxReviews) {
        value = String(maxReviews);
        toast.error("You don't have enough funds in your wallet. Add funds to request more reviews.");
      }
    }
    setValues((v) => ({ ...v, reviews: value }));
  }

  function setLocationId(e) {
    const locationId = e.target.value;
    setValues((v) => {
      const loc = locations.find((l) => l.id === locationId);
      const next = { ...v, locationId };
      // Same auto-fill courtesy as the create form — only when the URL/city
      // list is still empty or still holding just the previous location's
      // auto-added city, so a manual edit is never silently overwritten by
      // switching locations.
      const prevLoc = locations.find((l) => l.id === v.locationId);
      if (loc?.reviewUrl && (!next.targetUrl || next.targetUrl === prevLoc?.reviewUrl)) {
        next.targetUrl = loc.reviewUrl;
      }
      const citiesUntouched = next.cities.length === 0 || (next.cities.length === 1 && next.cities[0] === prevLoc?.city);
      if (loc?.city && citiesUntouched) {
        next.cities = [loc.city];
      }
      return next;
    });
  }

  function openModal() {
    // Reset to the campaign's current values each time it's opened, in case
    // a previous edit (or another tab) changed them since this component mounted.
    setValues(initialValues());
    setError("");
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setError("");
  }

  // Same escape-to-close + scroll-lock as NewCampaignModal.
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
    if (values.cityMode === "preferred" && values.cities.length === 0) {
      return setError("Add at least one city, or switch to All India.");
    }
    if (reviewsNum < minReviews) return setError(`Target can't go below ${minReviews} — that many are already collected.`);
    if (overBudget) {
      toast.error("You don't have enough funds in your wallet. Add funds to request more reviews.");
      return;
    }

    setPending(true);
    const res = await fetch(`/api/business/campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "edit",
        name: values.name.trim(),
        notes: values.notes.trim(),
        targetUrl: values.targetUrl.trim(),
        cities: values.cityMode === "all_india" ? [] : values.cities,
        reviews: Math.floor(reviewsNum),
        locationId: values.locationId || "",
      }),
    });
    setPending(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (/insufficient/i.test(data.error ?? "")) {
        toast.error("You don't have enough funds in your wallet. Add funds and try again.");
        return;
      }
      const message = data.error ?? "Couldn't update the campaign.";
      setError(message);
      toast.error(message);
      return;
    }

    toast.success("Campaign updated.");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      {trigger ? (
        trigger(openModal)
      ) : (
        <button
          type="button"
          onClick={openModal}
          aria-label="Edit campaign"
          title="Edit campaign"
          className="inline-flex items-center justify-center rounded-btn border border-default bg-surface p-2 text-secondary transition-colors duration-150 hover:bg-surface-sunken hover:text-primary"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit campaign"
          className="animate-fade-up fixed inset-0 z-50 flex items-center justify-center bg-surface-inverse/60 p-4 backdrop-blur-sm"
          style={{ animationDuration: "200ms" }}
          onClick={close}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-card border border-default bg-surface-raised shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header — sticky, stays put while the form body scrolls */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-default px-6 py-4 sm:px-8">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-primary">Edit campaign</h2>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-secondary">
                  <span className="inline-flex items-center gap-1.5">
                    <Wallet className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                    Wallet: <span className="font-bold text-primary">{inr(walletBalance)}</span>
                  </span>
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
            <form id="edit-campaign-form" onSubmit={onSubmit} className="min-h-0 flex-1 overflow-y-auto px-6 py-5 sm:px-8">
              <FormError>{error}</FormError>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="ec-name">Campaign name</Label>
                  <Input id="ec-name" value={values.name} onChange={set("name")} placeholder="Summer Google reviews" icon={Tag} />
                </div>

                {/* Platform — locked, shown read-only so it's still part of
                    the picture. Reviewer-side matching differs per platform,
                    so switching it after reviewers may already be claiming
                    slots isn't safe. */}
                <div>
                  <Label>Platform</Label>
                  <div className="flex items-center gap-2 rounded-btn border border-default bg-surface-sunken px-3 py-2.5 text-sm text-secondary">
                    <Globe2 className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                    {PLATFORM_LABEL[campaign.platform] ?? campaign.platform}
                  </div>
                </div>

                {isGoogle && locations.length > 0 && (
                  <div>
                    <Label htmlFor="ec-location">Location</Label>
                    <div className="group relative">
                      <MapPinned
                        className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted transition-colors duration-200 group-focus-within:text-accent"
                        aria-hidden="true"
                      />
                      <select id="ec-location" value={values.locationId} onChange={setLocationId} className={selectClass}>
                        <option value="">Not tied to a specific location</option>
                        {locations.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.title}
                            {l.areaLabel ? ` — ${l.areaLabel}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="ec-url">Review URL</Label>
                  <Input
                    id="ec-url"
                    type="url"
                    value={values.targetUrl}
                    onChange={set("targetUrl")}
                    placeholder="https://…"
                    icon={Link2}
                  />
                </div>

                <div>
                  <Label>Who can see this campaign</Label>
                  <div className="inline-flex rounded-lg border border-default bg-surface p-0.5" role="tablist" aria-label="Which reviewers can see this campaign">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={values.cityMode !== "preferred"}
                      onClick={() => setValues((v) => ({ ...v, cityMode: "all_india" }))}
                      className={`rounded-[5px] px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
                        values.cityMode !== "preferred" ? "bg-accent text-on-brand" : "text-secondary hover:text-primary"
                      }`}
                    >
                      All India
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={values.cityMode === "preferred"}
                      onClick={() => setValues((v) => ({ ...v, cityMode: "preferred" }))}
                      className={`rounded-[5px] px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
                        values.cityMode === "preferred" ? "bg-accent text-on-brand" : "text-secondary hover:text-primary"
                      }`}
                    >
                      Preferred city
                    </button>
                  </div>

                  {values.cityMode === "preferred" ? (
                    <div className="mt-2">
                      <CityMultiSelect
                        idPrefix="ec-cities"
                        cities={values.cities}
                        onChange={(cities) => setValues((prev) => ({ ...prev, cities }))}
                      />
                    </div>
                  ) : (
                    <p className="mt-1.5 text-xs text-muted">Open to reviewers anywhere in India.</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="ec-reviews">Target reviews</Label>
                  <Input
                    id="ec-reviews"
                    type="number"
                    min={minReviews}
                    max={maxReviews}
                    step="1"
                    inputMode="numeric"
                    value={values.reviews}
                    onChange={setReviews}
                    icon={Star}
                  />
                  <p className="mt-1.5 flex items-center justify-between text-xs text-muted">
                    <span>{campaign.collected} already collected — target can&apos;t go lower.</span>
                    <span className="nums font-semibold text-primary">
                      <IndianRupee className="mb-0.5 inline h-3 w-3" aria-hidden="true" />
                      {inr(campaign.ratePerReview)}/review
                    </span>
                  </p>
                </div>

                <div>
                  <Label htmlFor="ec-notes">Notes</Label>
                  <textarea
                    id="ec-notes"
                    value={values.notes}
                    onChange={set("notes")}
                    rows={3}
                    placeholder="Anything reviewers or your team should know"
                    className="w-full rounded-card border border-default bg-surface px-3 py-2.5 text-primary outline-none transition-all duration-200 placeholder:text-muted/70 hover:border-strong focus:border-accent focus:ring-2 focus:ring-accent/50"
                  />
                </div>

                {/* Live re-price preview — the wallet effect of the reviews
                    change above isn't obvious from the number alone. */}
                <div className="flex items-center justify-between rounded-btn border border-accent-border bg-accent-subtle px-3.5 py-2.5 text-sm">
                  <span className="inline-flex items-center gap-1.5 font-medium text-secondary">
                    <Target className="h-4 w-4 text-accent" aria-hidden="true" />
                    New budget
                  </span>
                  <span className="nums font-bold text-primary">
                    {inr(newBudget)}
                    {newBudget !== campaign.budget && (
                      <span className={newBudget > campaign.budget ? "ml-1.5 text-danger" : "ml-1.5 text-verified"}>
                        ({newBudget > campaign.budget ? "+" : ""}
                        {inr(newBudget - campaign.budget)})
                      </span>
                    )}
                  </span>
                </div>

                <p className="text-xs leading-relaxed text-muted">
                  <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-muted" aria-hidden="true" />
                  Only the ₹/review rate and platform stay fixed — raising the target debits the difference from
                  your wallet, lowering it refunds the difference.
                </p>
              </div>
            </form>

            {/* Footer — sticky */}
            <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-default px-6 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-8">
              <button
                type="button"
                onClick={close}
                className="w-full rounded-btn border border-default bg-surface px-4 py-2.5 text-sm font-semibold text-secondary transition-colors duration-200 hover:bg-surface-sunken sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-campaign-form"
                disabled={pending || overBudget}
                className="w-full rounded-btn bg-accent px-5 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 sm:w-auto"
              >
                {pending ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
