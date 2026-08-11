"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, IndianRupee, Loader2, Plus, Receipt, Wallet, X } from "lucide-react";
import { toast } from "../../lib/toast";

function inr(n) {
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

/** Loads the Razorpay Checkout script once, reusing it on later opens. */
function loadRazorpayScript() {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const QUICK_AMOUNTS = [100, 200, 300, 400, 500];

/**
 * Wallet balance + self-serve "Add funds" via Razorpay Checkout. Flow:
 *   1. POST /api/business/wallet/order → create a Razorpay order.
 *   2. Open Razorpay Checkout with that order.
 *   3. On success, POST /api/business/wallet/verify with the signature —
 *      the wallet only credits after that server-side verification.
 * A payment.captured webhook (api/webhooks/razorpay) is the backstop for a
 * user who closes the tab right after paying but before step 3 completes.
 */
export default function WalletCard({ balance, transactions, minTopup = 50 }) {
  const router = useRouter();
  // Open by default with a pre-filled amount, so landing on this card is
  // already "ready to pay" instead of needing an extra click to get there.
  const [open, setOpen] = useState(true);
  const [amount, setAmount] = useState(String(Math.max(QUICK_AMOUNTS[0], minTopup)));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  // Pre-fill a sensible default the first time the form opens, so the owner
  // can just hit Pay — but it's a normal input, so they can still edit it.
  function toggleOpen() {
    setOpen((v) => {
      const next = !v;
      if (next && !amount) setAmount(String(Math.max(QUICK_AMOUNTS[0], minTopup)));
      return next;
    });
  }

  // The topbar wallet chip links here with ?addFunds=1 (see business/layout.jsx)
  // so clicking it opens straight into a pre-filled, ready-to-pay form instead
  // of landing on the page and needing a second click. Checked via
  // window.location rather than useSearchParams so this client component
  // doesn't force a Suspense boundary on the settings page around it.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("addFunds") === "1") {
      setAmount(String(Math.max(QUICK_AMOUNTS[0], minTopup)));
      setOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addFunds(e) {
    e.preventDefault();
    setError("");
    const value = Number(amount);
    if (!Number.isInteger(value) || value < minTopup) {
      setError(`Enter an amount of at least ${inr(minTopup)}.`);
      return;
    }

    setPending(true);
    try {
      const scriptOk = await loadRazorpayScript();
      if (!scriptOk) {
        setError("Couldn't load the payment gateway. Check your connection and try again.");
        setPending(false);
        return;
      }

      const orderRes = await fetch("/api/business/wallet/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: value }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        setError(orderData.error || "Couldn't start the payment.");
        setPending(false);
        return;
      }

      const rzp = new window.Razorpay({
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        order_id: orderData.orderId,
        name: "RapportLook",
        description: "Wallet top-up",
        theme: { color: "#2563eb" },
        handler: async (result) => {
          const verifyRes = await fetch("/api/business/wallet/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: result.razorpay_order_id,
              razorpay_payment_id: result.razorpay_payment_id,
              razorpay_signature: result.razorpay_signature,
              amount: value,
            }),
          });
          const verifyData = await verifyRes.json().catch(() => ({}));
          if (!verifyRes.ok) {
            toast.error(verifyData.error || "Payment succeeded but verification failed — contact support.");
            return;
          }
          toast.success(`${inr(value)} added to your wallet.`);
          setOpen(false);
          setAmount("");
          router.refresh();
        },
        modal: {
          ondismiss: () => setPending(false),
        },
      });
      rzp.on("payment.failed", (resp) => {
        toast.error(resp.error?.description || "Payment failed.");
        setPending(false);
      });
      rzp.open();
      setPending(false);
    } catch {
      setError("Something went wrong. Try again.");
      setPending(false);
    }
  }

  return (
    <div className="rounded-card border border-default bg-surface-raised p-6 shadow-sm transition-shadow duration-300 hover:shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-subtle text-accent">
            <Wallet className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm text-secondary">Wallet balance</p>
            <p className="nums text-2xl font-bold tracking-tight text-primary">{inr(balance)}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleOpen}
          className="inline-flex items-center gap-2 rounded-btn bg-accent px-4 py-2 text-sm font-semibold text-on-brand shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-md"
        >
          {open ? <X className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
          {open ? "Cancel" : "Add funds"}
        </button>
      </div>

      {open && (
        <form onSubmit={addFunds} className="mt-5 border-t border-default pt-4">
          <label htmlFor="topup-amount" className="text-sm font-medium text-secondary">
            Amount to add (₹)
          </label>
          <div className="mt-2 flex items-center gap-2">
            <div className="relative flex-1">
              <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                id="topup-amount"
                type="number"
                min={minTopup}
                step="1"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 1000"
                className="w-full rounded-btn border border-default bg-surface py-2.5 pl-9 pr-3 text-sm text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-btn bg-accent px-4 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition-all duration-200 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Pay
            </button>
          </div>
          {error ? (
            <p className="mt-2 text-xs text-danger">{error}</p>
          ) : (
            <p className="mt-2 text-xs text-muted">Minimum top-up: {inr(minTopup)}.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {QUICK_AMOUNTS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAmount(String(v))}
                className="rounded-full border border-default px-3 py-1 text-xs font-medium text-secondary transition-colors duration-150 hover:border-accent hover:text-accent"
              >
                {inr(v)}
              </button>
            ))}
          </div>
        </form>
      )}

      {/* Recent transactions */}
      <div className="mt-5 border-t border-default pt-4">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">Recent transactions</p>
        {transactions.length === 0 ? (
          <div className="mt-4 flex flex-col items-center gap-2 py-4 text-center">
            <Receipt className="h-6 w-6 text-muted" aria-hidden="true" />
            <p className="text-sm text-secondary">No transactions yet.</p>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-default">
            {transactions.map((t) => {
              const positive = t.amount >= 0;
              return (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm transition-colors duration-150 hover:bg-surface-sunken/60">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${positive ? "bg-verified-subtle" : "bg-danger-subtle"}`}>
                      {positive ? (
                        <ArrowDownLeft className="h-4 w-4 text-verified" aria-hidden="true" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4 text-danger" aria-hidden="true" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-primary">
                        {t.note || (t.type === "topup" ? "Top-up" : t.type)}
                      </span>
                      <span className="block text-xs text-muted">{new Date(t.at).toLocaleDateString("en-IN")}</span>
                    </span>
                  </span>
                  <span className={`nums shrink-0 font-semibold ${positive ? "text-verified" : "text-danger"}`}>
                    {positive ? "+" : "−"}
                    {inr(Math.abs(t.amount))}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
