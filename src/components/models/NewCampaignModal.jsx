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
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { inr } from "../../lib/campaigns";
import { findStateForCity } from "../../lib/data/indiaStatesCities";
import { Label, Input, FormError } from "../auth/Field";
import StateCitySelect from "../ui/StateCitySelect";
import { toast } from "../../lib/toast";

const selectClass =
  "w-full appearance-none rounded-btn border border-default bg-surface py-2.5 pl-10 pr-3 text-primary outline-none transition-all duration-200 hover:border-strong focus:border-accent focus:ring-2 focus:ring-accent/50";

/**
 * Create-campaign modal. The owner enters how many reviews they want, not a
 * ₹ amount — the price is derived live at the admin-controlled ₹/review rate
 * and shown as a read-only total. Blocks submit when that price exceeds the
 * wallet balance. Posts to /api/business/campaigns (still budget-based) which
 * debits the wallet.
 *
 * Google + connected GMB locations gets a different mode: instead of one
 * review URL / one review count, the owner picks any number of locations
 * (one row each, "+ Add location") — each row auto-fills its own review URL
 * from that location and takes its own review-count slice. Submitting
 * creates one campaign PER selected location, all funded from a single
 * wallet debit. Any other platform, or no connected locations at all, falls
 * back to the original single review-URL / single-count form.
 */
export default function NewCampaignModal({ walletBalance, locations = [], rate = 100 }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({ name: "", platform: "google", reviews: "", notes: "", locationId: "", targetUrl: "", state: "", city: "" });
  const [rows, setRows] = useState(locations.length > 0 ? [{ locationId: "", reviews: "", targetUrl: "", state: "", city: "" }] : []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const multiMode = values.platform === "google" && locations.length > 0;

  // Max reviews the wallet can fund — the number-of-reviews field is clamped
  // to this instead of a raw ₹ amount, so the price is always derived, never
  // entered directly.
  const maxReviews = Math.floor(walletBalance / rate);

  const reviewsNum = Number(values.reviews) || 0;
  const budgetNum = reviewsNum * rate;
  const reviews = reviewsNum;
  const overBudget = budgetNum > walletBalance;
  const selectedLocation = locations.find((l) => l.id === values.locationId);
  const autoFilledUrl =
    values.platform === "google" &&
    Boolean(selectedLocation?.reviewUrl) &&
    values.targetUrl === selectedLocation.reviewUrl;

  const rowsTotal = rows.reduce((sum, r) => sum + (Number(r.reviews) || 0) * rate, 0);
  const rowsOverBudget = rowsTotal > walletBalance;
  const usedLocationIds = new Set(rows.map((r) => r.locationId).filter(Boolean));
  const canAddRow = rows.length < locations.length;

  function set(key) {
    return (e) => {
      let value = e.target.value;
      // Reviews can't even be TYPED past what the wallet affords — clamp it
      // live instead of only catching it on submit, and say why with a toast.
      if (key === "reviews" && value !== "") {
        const n = Number(value);
        if (!Number.isNaN(n) && n > maxReviews) {
          value = String(maxReviews);
          toast.error("You don't have enough funds in your wallet. Add funds to request more reviews.");
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
          // Same auto-fill for city — only when the field is still empty or
          // still holding the previous location's auto-filled city, so a
          // manual edit never gets clobbered by switching locations. Only
          // applied when the derived city is an exact match in the dataset
          // (findStateForCity) — otherwise the dropdown would have nothing
          // valid to show and the owner picks manually instead.
          const prevLoc = locations.find((l) => l.id === v.locationId);
          const cityUntouched = !next.city || next.city === prevLoc?.city;
          if (key === "locationId" && cityUntouched && loc?.city) {
            const matchedState = findStateForCity(loc.city);
            if (matchedState) {
              next.state = matchedState;
              next.city = loc.city;
            }
          }
        }

        return next;
      });
    };
  }

  function addRow() {
    setRows((r) => [...r, { locationId: "", reviews: "", targetUrl: "", state: "", city: "" }]);
  }

  function removeRow(index) {
    setRows((r) => r.filter((_, i) => i !== index));
  }

  function setRow(index, key, value) {
    setRows((r) => {
      const next = [...r];
      const row = { ...next[index], [key]: value };

      // Picking a location auto-fills its review URL, but only if the field
      // is still untouched (empty, or still holding the PREVIOUS location's
      // auto-filled link) — an owner's manual edit is never clobbered by
      // switching locations back and forth.
      if (key === "locationId") {
        const prevLoc = locations.find((l) => l.id === next[index].locationId);
        const untouched = !row.targetUrl || row.targetUrl === prevLoc?.reviewUrl;
        const newLoc = locations.find((l) => l.id === value);
        if (untouched && newLoc?.reviewUrl) row.targetUrl = newLoc.reviewUrl;

        const cityUntouched = !row.city || row.city === prevLoc?.city;
        if (cityUntouched && newLoc?.city) {
          const matchedState = findStateForCity(newLoc.city);
          if (matchedState) {
            row.state = matchedState;
            row.city = newLoc.city;
          }
        }
      }

      // Clamp per-row reviews so the running total can never be typed past
      // the wallet balance either.
      if (key === "reviews" && value !== "") {
        const n = Number(value);
        const otherTotal = next.reduce((sum, x, i) => (i === index ? sum : sum + (Number(x.reviews) || 0) * rate), 0);
        if (!Number.isNaN(n) && otherTotal + n * rate > walletBalance) {
          row.reviews = String(Math.max(0, Math.floor((walletBalance - otherTotal) / rate)));
          toast.error("You don't have enough funds in your wallet. Add funds to request more reviews.");
        }
      }

      next[index] = row;
      return next;
    });
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

    let body;
    if (multiMode) {
      const filled = rows.filter((r) => r.locationId && r.reviews);
      if (filled.length === 0) return setError("Add at least one location with a number of reviews.");
      for (const r of filled) {
        const loc = locations.find((l) => l.id === r.locationId);
        if (!r.targetUrl?.trim()) {
          return setError(`Add a review URL for ${loc?.title || "each location"}.`);
        }
        if (!r.city?.trim()) {
          return setError(`Add a city for ${loc?.title || "each location"}.`);
        }
        if ((Number(r.reviews) || 0) < 1) {
          return setError(`Ask for at least 1 review for ${loc?.title || "each location"}.`);
        }
      }
      if (rowsOverBudget) {
        toast.error("You don't have enough funds in your wallet. Add funds to request more reviews.");
        return;
      }
      body = {
        name: values.name.trim(),
        platform: "google",
        notes: values.notes.trim(),
        locations: filled.map((r) => ({
          locationId: r.locationId,
          budget: Math.floor(Number(r.reviews)) * rate,
          targetUrl: r.targetUrl?.trim() || undefined,
          city: r.city?.trim() || undefined,
        })),
      };
    } else {
      if (!values.targetUrl.trim()) return setError("Add the review URL where customers should leave a review.");
      if (!values.city.trim()) return setError("Add the city this campaign is for.");
      if (reviewsNum < 1) return setError("Ask for at least 1 review.");
      if (overBudget) {
        toast.error("You don't have enough funds in your wallet. Add funds to request more reviews.");
        return;
      }
      body = {
        name: values.name.trim(),
        platform: values.platform,
        budget: Math.floor(budgetNum),
        notes: values.notes.trim(),
        targetUrl: values.targetUrl.trim(),
        city: values.city.trim(),
        locationId: values.locationId || undefined,
      };
    }

    setPending(true);
    const res = await fetch("/api/business/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setPending(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // The API's own insufficient-balance message is a race-safety net (the
      // wallet could have been spent elsewhere between page load and submit)
      // — still surfaced as the same toast, not a generic inline error.
      if (/insufficient/i.test(data.error ?? "")) {
        toast.error("You don't have enough funds in your wallet. Add funds to increase your budget.");
        return;
      }
      const message = data.error ?? "Couldn't create the campaign.";
      setError(message);
      toast.error(message);
      return;
    }

    toast.success(multiMode && body.locations.length > 1 ? `${body.locations.length} campaigns created.` : "Campaign created.");
    setValues({ name: "", platform: "google", reviews: "", notes: "", locationId: "", targetUrl: "", state: "", city: "" });
    setRows(locations.length > 0 ? [{ locationId: "", reviews: "", targetUrl: "", state: "", city: "" }] : []);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-btn bg-accent px-4 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-md sm:w-auto"
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
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-default px-6 py-4 sm:px-8">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-primary">New campaign</h2>
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
            <form id="new-campaign-form" onSubmit={onSubmit} className="min-h-0 flex-1 overflow-y-auto px-6 py-5 sm:px-8">
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

                {multiMode ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="c-loc-0">Locations</Label>
                      <span className="text-xs text-muted">Pick a location, its review URL fills in automatically.</span>
                    </div>

                    {rows.map((row, i) => {
                      const loc = locations.find((l) => l.id === row.locationId);
                      const rowReviews = Number(row.reviews) || 0;
                      const rowPrice = rowReviews * rate;
                      return (
                        <div key={i} className="rounded-card border border-default bg-surface p-4">
                          {/* Row header — "Location N" + remove, so a stack of rows reads
                              as a numbered list rather than identical unlabeled cards. */}
                          <div className="flex items-center justify-between">
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                              Location {i + 1}
                            </span>
                            {rows.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeRow(i)}
                                aria-label="Remove location"
                                className="rounded-full p-1 text-muted transition-colors duration-200 hover:bg-danger-subtle hover:text-danger"
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </button>
                            )}
                          </div>

                          <div className="mt-2.5 space-y-2.5">
                            <select
                              id={`c-loc-${i}`}
                              value={row.locationId}
                              onChange={(e) => setRow(i, "locationId", e.target.value)}
                              className="w-full appearance-none rounded-btn border border-default bg-surface-raised px-3 py-2.5 text-sm text-primary outline-none transition-all duration-200 hover:border-strong focus:border-accent focus:ring-2 focus:ring-accent/50"
                            >
                              <option value="">Choose a location…</option>
                              {locations
                                .filter((l) => l.id === row.locationId || !usedLocationIds.has(l.id))
                                .map((l) => (
                                  <option key={l.id} value={l.id}>
                                    {l.title}
                                    {l.city ? ` — ${l.city}` : ""}
                                  </option>
                                ))}
                            </select>

                            {row.locationId && (
                              <div>
                                <Input
                                  id={`c-url-${i}`}
                                  type="url"
                                  inputMode="url"
                                  value={row.targetUrl}
                                  onChange={(e) => setRow(i, "targetUrl", e.target.value)}
                                  placeholder="https://g.page/r/your-business/review"
                                  icon={Link2}
                                  className="text-sm"
                                />
                                {row.targetUrl && row.targetUrl === loc?.reviewUrl ? (
                                  <p className="mt-1 flex items-center gap-1 text-xs font-medium text-verified">
                                    <Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" />
                                    Auto-filled — edit if this isn&apos;t right.
                                  </p>
                                ) : !loc?.reviewUrl ? (
                                  <p className="mt-1 text-xs text-danger">No review link synced for this location — paste one manually.</p>
                                ) : (
                                  <p className="mt-1 text-xs text-muted">Where reviewers should leave their review.</p>
                                )}

                                <div className="mt-2.5">
                                  <StateCitySelect
                                    idPrefix={`c-loc-${i}`}
                                    state={row.state}
                                    city={row.city}
                                    onStateChange={(state) => {
                                      setRow(i, "state", state);
                                      setRow(i, "city", "");
                                    }}
                                    onCityChange={(city) => setRow(i, "city", city)}
                                  />
                                  {row.city && row.city === loc?.city && (
                                    <p className="mt-1 flex items-center gap-1 text-xs font-medium text-verified">
                                      <Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" />
                                      Auto-filled — edit if this isn&apos;t right.
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}

                            <div className="flex flex-col gap-2 border-t border-default pt-2.5 sm:flex-row sm:items-center sm:gap-2.5">
                              <div className="w-full shrink-0 sm:w-32">
                                <Input
                                  id={`c-reviews-${i}`}
                                  type="number"
                                  min={1}
                                  max={maxReviews}
                                  step="1"
                                  inputMode="numeric"
                                  value={row.reviews}
                                  onChange={(e) => setRow(i, "reviews", e.target.value)}
                                  placeholder="Reviews"
                                  icon={Star}
                                  className="text-sm"
                                />
                              </div>
                              <p className="text-xs text-secondary">
                                {row.reviews ? (
                                  <>
                                    <span className="font-semibold text-primary">{inr(rowPrice)}</span> for this location
                                  </>
                                ) : (
                                  `Number of reviews at this location (${inr(rate)} each)`
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      onClick={addRow}
                      disabled={!canAddRow}
                      className="inline-flex items-center gap-1.5 rounded-btn border border-dashed border-default bg-surface px-3.5 py-2 text-sm font-semibold text-accent transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:bg-accent-subtle disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Add another location
                    </button>

                    {/* Live estimate — total across every row */}
                    {(() => {
                      const filledCount = rows.filter((r) => r.locationId && r.reviews).length;
                      const totalReviews = rows.reduce((sum, r) => sum + (Number(r.reviews) || 0), 0);
                      if (filledCount === 0) {
                        return (
                          <div className="rounded-card border border-dashed border-default bg-surface px-4 py-3 text-center text-xs text-muted">
                            Pick a location and set the number of reviews to see the price.
                          </div>
                        );
                      }
                      return (
                        <div className="flex items-center gap-3 rounded-card border border-accent-border bg-accent-subtle p-4">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15">
                            <Star className="h-5 w-5 fill-accent text-accent" aria-hidden="true" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold uppercase tracking-wide text-accent">Total reviews</p>
                            <p className="text-2xl font-bold leading-tight tracking-tight text-primary">
                              {totalReviews} review{totalReviews === 1 ? "" : "s"}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-lg font-bold leading-tight text-primary">{inr(rowsTotal)}</p>
                            <p className="text-xs text-secondary">{filledCount} location{filledCount === 1 ? "" : "s"}</p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <>
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
                      <Label htmlFor="c-state-state">State &amp; city</Label>
                      <StateCitySelect
                        idPrefix="c-state"
                        state={values.state}
                        city={values.city}
                        onStateChange={(state) => setValues((v) => ({ ...v, state, city: "" }))}
                        onCityChange={(city) => setValues((v) => ({ ...v, city }))}
                      />
                      <p className="mt-1.5 text-xs text-muted">
                        Reviewers only see this campaign if it&apos;s in (or near) their own city.
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="c-reviews">Number of reviews</Label>
                      <Input
                        id="c-reviews"
                        type="number"
                        min={1}
                        max={maxReviews}
                        step="1"
                        inputMode="numeric"
                        value={values.reviews}
                        onChange={set("reviews")}
                        placeholder="100"
                        icon={Star}
                        error={overBudget}
                      />
                      <p className="mt-1.5 text-xs text-muted">Flat rate {inr(rate)} per verified review.</p>
                    </div>

                    {/* Live price */}
                    <div className="rounded-btn border border-accent-border bg-accent-subtle px-4 py-3">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
                          <IndianRupee className="h-4 w-4 text-accent" aria-hidden="true" />
                          Total price
                        </span>
                        <span className="text-2xl font-bold tracking-tight text-primary">{inr(budgetNum)}</span>
                      </div>
                      <p className="mt-1 text-xs text-secondary">
                        {reviews} review{reviews === 1 ? "" : "s"} × {inr(rate)} per review
                      </p>
                    </div>
                  </>
                )}

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
                      className="w-full resize-none rounded-2xl border border-default bg-surface py-2.5 pl-10 pr-3 text-primary outline-none transition-all duration-200 placeholder:text-muted/70 hover:border-strong focus:border-accent focus:ring-2 focus:ring-accent/50"
                    />
                  </div>
                </div>
              </div>
            </form>

            {/* Footer — sticky. Stacks full-width on mobile (primary action on
                top) since the submit label is dynamic and can run long
                ("Start 3 campaign(s) · ₹15,000") — side-by-side would clip it
                on a narrow screen. */}
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
                form="new-campaign-form"
                disabled={pending || (multiMode ? rowsOverBudget : overBudget)}
                className="w-full rounded-btn bg-accent px-5 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 sm:w-auto"
              >
                {pending
                  ? "Creating…"
                  : multiMode
                    ? `Start ${rows.filter((r) => r.locationId).length || ""} campaign(s) · ${inr(rowsTotal)}`
                    : `Start campaign · ${inr(budgetNum)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
