"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Star, Wallet, X } from "lucide-react";
import { RATE_PER_REVIEW, approxReviews, inr } from "../../lib/campaigns";

/**
 * Create-campaign form. Shows a live "approx reviews" preview from the budget at
 * the flat ₹/review rate, and blocks submit when the budget exceeds the wallet
 * balance. Posts to /api/business/campaigns which debits the wallet server-side.
 */
export default function NewCampaignForm({ walletBalance, locations = [] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({ name: "", platform: "google", budget: "", notes: "", locationId: "", targetUrl: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const budgetNum = Number(values.budget) || 0;
  const reviews = approxReviews(budgetNum);
  const overBudget = budgetNum > walletBalance;

  function set(key) {
    return (e) => setValues((v) => ({ ...v, [key]: e.target.value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (!values.name.trim()) return setError("Give your campaign a name.");
    if (!values.targetUrl.trim()) return setError("Add the review URL where customers should leave a review.");
    if (budgetNum < RATE_PER_REVIEW) return setError(`Minimum budget is ${inr(RATE_PER_REVIEW)} (one review).`);
    if (overBudget) return setError("Budget exceeds your wallet balance. Add funds first.");

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
    if (!res.ok) return setError(data.error ?? "Couldn't create the campaign.");

    setValues({ name: "", platform: "google", budget: "", notes: "", locationId: "", targetUrl: "" });
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-btn bg-accent px-4 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition hover:bg-accent-hover"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        New campaign
      </button>
    );
  }

  return (
    <div className="rounded-card border border-default bg-surface-raised p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-primary">New campaign</h2>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-muted hover:text-primary">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {/* Wallet balance reminder */}
      <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-secondary">
        <Wallet className="h-4 w-4 text-accent" aria-hidden="true" />
        Wallet balance: <span className="font-bold text-primary">{inr(walletBalance)}</span>
        <Link href="/business/settings" className="ml-1 font-semibold text-accent hover:underline">
          Add funds
        </Link>
      </p>

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <div>
          <label htmlFor="c-name" className="mb-1.5 block text-sm font-medium text-primary">Campaign name</label>
          <input id="c-name" value={values.name} onChange={set("name")} placeholder="Summer Google reviews"
            className="w-full rounded-btn border border-default bg-surface px-3 py-2.5 text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/50" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="c-platform" className="mb-1.5 block text-sm font-medium text-primary">Platform</label>
            <select id="c-platform" value={values.platform} onChange={set("platform")}
              className="w-full rounded-btn border border-default bg-surface px-3 py-2.5 text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/50">
              <option value="google">Google</option>
              <option value="trustpilot">Trustpilot</option>
              <option value="capterra">Capterra</option>
              <option value="amazon">Amazon</option>
              <option value="playstore">Play Store</option>
            </select>
          </div>

          {locations.length > 0 && (
            <div>
              <label htmlFor="c-loc" className="mb-1.5 block text-sm font-medium text-primary">Location (optional)</label>
              <select id="c-loc" value={values.locationId} onChange={set("locationId")}
                className="w-full rounded-btn border border-default bg-surface px-3 py-2.5 text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/50">
                <option value="">All locations</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.title}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="c-url" className="mb-1.5 block text-sm font-medium text-primary">Review URL</label>
          <input id="c-url" type="url" inputMode="url" value={values.targetUrl} onChange={set("targetUrl")}
            placeholder="https://g.page/r/your-business/review"
            className="w-full rounded-btn border border-default bg-surface px-3 py-2.5 text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/50" />
          <p className="mt-1.5 text-xs text-muted">The link where reviewers should leave their review (e.g. your Google review link).</p>
        </div>

        <div>
          <label htmlFor="c-budget" className="mb-1.5 block text-sm font-medium text-primary">Budget (₹)</label>
          <input id="c-budget" type="number" min={RATE_PER_REVIEW} step="100" inputMode="numeric"
            value={values.budget} onChange={set("budget")} placeholder="10000"
            className={`w-full rounded-btn border bg-surface px-3 py-2.5 text-primary outline-none focus:ring-2 focus:ring-accent/50 ${overBudget ? "border-danger" : "border-default focus:border-accent"}`} />
          <p className="mt-1.5 text-xs text-muted">Flat rate {inr(RATE_PER_REVIEW)} per verified review.</p>
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
            {inr(budgetNum)} ÷ {inr(RATE_PER_REVIEW)} per review
          </p>
        </div>

        <div>
          <label htmlFor="c-notes" className="mb-1.5 block text-sm font-medium text-primary">What do you need? (optional)</label>
          <textarea id="c-notes" rows={3} value={values.notes} onChange={set("notes")} maxLength={500}
            placeholder="e.g. Focus on our new outlet, verified customers only, target a 4.5+ average."
            className="w-full rounded-btn border border-default bg-surface px-3 py-2.5 text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/50" />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending || overBudget}
            className="rounded-btn bg-accent px-5 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60">
            {pending ? "Creating…" : `Start campaign · ${inr(budgetNum)}`}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="text-sm font-semibold text-secondary hover:text-primary">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
