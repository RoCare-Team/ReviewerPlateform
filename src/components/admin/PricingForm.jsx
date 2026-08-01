"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Admin pricing control. Edits the two global prices that drive the whole app:
 * what a business pays per review, and what a reviewer earns per verified review.
 */
export default function PricingForm({ initial }) {
  const router = useRouter();
  const [reviewRate, setReviewRate] = useState(String(initial.reviewRate));
  const [reviewerReward, setReviewerReward] = useState(String(initial.reviewerReward));
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setMsg(null);
    const rate = Number(reviewRate);
    const reward = Number(reviewerReward);
    if (!Number.isInteger(rate) || rate <= 0 || !Number.isInteger(reward) || reward <= 0) {
      return setMsg({ tone: "error", text: "Enter valid whole-rupee amounts." });
    }
    if (reward > rate) return setMsg({ tone: "error", text: "Reviewer reward can't exceed the review rate." });

    setPending(true);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewRate: rate, reviewerReward: reward }),
    });
    setPending(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg({ tone: "error", text: data.error ?? "Update failed." });
    setMsg({ tone: "ok", text: "Pricing updated." });
    router.refresh();
  }

  const margin = Number(reviewRate) - Number(reviewerReward);

  return (
    <form onSubmit={onSubmit} className="max-w-lg">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="rate" className="mb-1.5 block text-sm font-medium text-primary">
            Business pays / review (₹)
          </label>
          <input id="rate" type="number" min="1" value={reviewRate} onChange={(e) => setReviewRate(e.target.value)}
            className="w-full rounded-btn border border-default bg-surface px-3 py-2.5 text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/50" />
        </div>
        <div>
          <label htmlFor="reward" className="mb-1.5 block text-sm font-medium text-primary">
            Reviewer earns / verified review (₹)
          </label>
          <input id="reward" type="number" min="1" value={reviewerReward} onChange={(e) => setReviewerReward(e.target.value)}
            className="w-full rounded-btn border border-default bg-surface px-3 py-2.5 text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/50" />
        </div>
      </div>

      <p className="mt-4 rounded-btn border border-default bg-surface-sunken px-3 py-2 text-sm text-secondary">
        Platform margin per review: <span className="font-bold text-primary">₹{Number.isFinite(margin) ? margin : 0}</span>
      </p>

      {msg && (
        <p className={`mt-3 text-sm font-medium ${msg.tone === "ok" ? "text-verified" : "text-danger"}`}>{msg.text}</p>
      )}

      <button type="submit" disabled={pending}
        className="mt-5 rounded-btn bg-accent px-5 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition hover:bg-accent-hover disabled:opacity-60">
        {pending ? "Saving…" : "Save pricing"}
      </button>
    </form>
  );
}
