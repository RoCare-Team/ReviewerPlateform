"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "../../lib/toast";

/**
 * Admin platform control. Edits the global prices that drive the whole app:
 * what a business pays per review, what a reviewer earns per verified review,
 * the smallest amount a reviewer is allowed to request as a withdrawal, and
 * the smallest amount a business is allowed to add to its wallet.
 *
 * Plus the one non-price global: the reviewer cooldown — how many hours a
 * reviewer must leave between two submissions. Saved through the same PATCH
 * so admin changes everything platform-wide in one place and one action.
 */
export default function PricingForm({ initial }) {
  const router = useRouter();
  const [reviewRate, setReviewRate] = useState(String(initial.reviewRate));
  const [reviewerReward, setReviewerReward] = useState(String(initial.reviewerReward));
  const [minWithdrawal, setMinWithdrawal] = useState(String(initial.minWithdrawal));
  const [minTopup, setMinTopup] = useState(String(initial.minTopup));
  const [referralReward, setReferralReward] = useState(String(initial.referralReward));
  const [cooldownHours, setCooldownHours] = useState(String(initial.reviewerCooldownHours ?? 4));
  // "manual" | "razorpayx" — see models/AppSettings.js#payoutMode.
  const [payoutMode, setPayoutMode] = useState(initial.payoutMode ?? "manual");
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setMsg(null);
    const rate = Number(reviewRate);
    const reward = Number(reviewerReward);
    const minOut = Number(minWithdrawal);
    const minIn = Number(minTopup);
    const referral = Number(referralReward);
    // 0 is deliberately allowed here and nowhere else — it's how admin turns
    // the cooldown off, whereas a ₹0 price would just break the platform.
    // An EMPTY box is not 0 though: Number("") is 0, which would silently
    // switch the cooldown off on a cleared field, so it's rejected below.
    const cooldown = cooldownHours.trim() === "" ? NaN : Number(cooldownHours);
    if (
      !Number.isInteger(rate) || rate <= 0 ||
      !Number.isInteger(reward) || reward <= 0 ||
      !Number.isInteger(minOut) || minOut <= 0 ||
      !Number.isInteger(minIn) || minIn <= 0 ||
      !Number.isInteger(referral) || referral <= 0
    ) {
      const text = "Enter valid whole-rupee amounts.";
      setMsg({ tone: "error", text });
      toast.error(text);
      return;
    }
    if (!Number.isInteger(cooldown) || cooldown < 0 || cooldown > 168) {
      const text = "Reviewer cooldown must be a whole number of hours between 0 and 168.";
      setMsg({ tone: "error", text });
      toast.error(text);
      return;
    }
    if (reward > rate) {
      const text = "Reviewer reward can't exceed the review rate.";
      setMsg({ tone: "error", text });
      toast.error(text);
      return;
    }

    setPending(true);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reviewRate: rate,
        reviewerReward: reward,
        minWithdrawal: minOut,
        minTopup: minIn,
        referralReward: referral,
        reviewerCooldownHours: cooldown,
        payoutMode,
      }),
    });
    setPending(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const text = data.error ?? "Update failed.";
      setMsg({ tone: "error", text });
      toast.error(text);
      return;
    }
    setMsg({ tone: "ok", text: "Settings updated." });
    toast.success("Settings updated.");
    router.refresh();
  }

  const margin = Number(reviewRate) - Number(reviewerReward);

  return (
    <form onSubmit={onSubmit} className="max-w-3xl">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
        <div>
          <label htmlFor="minWithdrawal" className="mb-1.5 block text-sm font-medium text-primary">
            Minimum withdrawal (₹)
          </label>
          <input id="minWithdrawal" type="number" min="1" value={minWithdrawal} onChange={(e) => setMinWithdrawal(e.target.value)}
            className="w-full rounded-btn border border-default bg-surface px-3 py-2.5 text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/50" />
          <p className="mt-1.5 text-xs text-muted">Smallest amount a reviewer can request as a payout.</p>
        </div>
        <div>
          <label htmlFor="minTopup" className="mb-1.5 block text-sm font-medium text-primary">
            Minimum wallet top-up (₹)
          </label>
          <input id="minTopup" type="number" min="1" value={minTopup} onChange={(e) => setMinTopup(e.target.value)}
            className="w-full rounded-btn border border-default bg-surface px-3 py-2.5 text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/50" />
          <p className="mt-1.5 text-xs text-muted">Smallest amount a business can add to its wallet.</p>
        </div>
        <div>
          <label htmlFor="referralReward" className="mb-1.5 block text-sm font-medium text-primary">
            Referral bonus (₹)
          </label>
          <input id="referralReward" type="number" min="1" value={referralReward} onChange={(e) => setReferralReward(e.target.value)}
            className="w-full rounded-btn border border-default bg-surface px-3 py-2.5 text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/50" />
          <p className="mt-1.5 text-xs text-muted">Paid to whoever&apos;s referral code a new signup used.</p>
        </div>
      </div>

      <p className="mt-4 rounded-btn border border-default bg-surface-sunken px-3 py-2 text-sm text-secondary">
        Platform margin per review: <span className="font-bold text-primary">₹{Number.isFinite(margin) ? margin : 0}</span>
      </p>

      {/* Not a price — kept visually separate so it doesn't read as one, but
          in the same form because it's the same "global platform setting" save. */}
      <div className="mt-6 border-t border-default pt-6">
        <h3 className="text-sm font-bold text-primary">Reviewer pacing</h3>
        <div className="mt-4 max-w-xs">
          <label htmlFor="cooldownHours" className="mb-1.5 block text-sm font-medium text-primary">
            Gap between reviews (hours)
          </label>
          <input id="cooldownHours" type="number" min="0" max="168" step="1" value={cooldownHours}
            onChange={(e) => setCooldownHours(e.target.value)}
            className="w-full rounded-btn border border-default bg-surface px-3 py-2.5 text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/50" />
          <p className="mt-1.5 text-xs text-muted">
            After a reviewer submits, they can&apos;t submit their next review — on any campaign —
            until this many hours have passed. Spacing reviews out is what keeps a reviewer&apos;s
            account from looking like a burst of fake engagement. Set to <span className="font-semibold">0</span> to
            switch the cooldown off.
          </p>
        </div>
      </div>

      {/* Also not a price — how an approved withdrawal actually reaches the
          reviewer. Lives here because it's the same platform-wide save. */}
      <div className="mt-6 border-t border-default pt-6">
        <h3 className="text-sm font-bold text-primary">Reviewer payouts</h3>
        <div className="mt-3 inline-flex rounded-lg border border-default bg-surface p-0.5" role="tablist" aria-label="How approved withdrawals are paid">
          {[
            { key: "manual", label: "Manual" },
            { key: "razorpayx", label: "Automatic (RazorpayX)" },
          ].map((m) => (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={payoutMode === m.key}
              onClick={() => setPayoutMode(m.key)}
              className={`rounded-[5px] px-3.5 py-1.5 text-sm font-semibold transition-all duration-200 ${
                payoutMode === m.key ? "bg-accent text-on-brand" : "text-secondary hover:text-primary"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="mt-2 max-w-xl text-xs text-muted">
          {payoutMode === "razorpayx" ? (
            <>
              Approving a withdrawal fires a real RazorpayX payout to the reviewer&apos;s bank account.
              Needs RazorpayX activated on the Razorpay account plus{" "}
              <span className="font-semibold">RAZORPAYX_ACCOUNT_NUMBER</span> set — until then approvals are
              refused with an explanation rather than failing halfway.
            </>
          ) : (
            <>
              You transfer the money yourself (UPI/bank), then mark the request paid on the Withdrawals page.
              Nothing is sent to any payment gateway. Switch to Automatic once RazorpayX is live.
            </>
          )}
        </p>
      </div>

      {msg && (
        <p className={`mt-3 text-sm font-medium ${msg.tone === "ok" ? "text-verified" : "text-danger"}`}>{msg.text}</p>
      )}

      <button type="submit" disabled={pending}
        className="mt-5 rounded-btn bg-accent px-5 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition hover:bg-accent-hover disabled:opacity-60">
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
