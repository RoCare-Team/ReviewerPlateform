"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet, Plus } from "lucide-react";

/**
 * Wallet balance + add-funds. Posts to /api/business/wallet (a mock top-up —
 * credits immediately, no gateway yet). Receives the current balance and recent
 * transactions from the server page.
 */
const QUICK = [500, 1000, 5000, 10000];

function inr(n) {
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

export default function WalletCard({ balance, transactions }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function addFunds(e) {
    e.preventDefault();
    setError("");
    const value = Number(amount);
    if (!Number.isInteger(value) || value <= 0) {
      setError("Enter a valid amount in rupees.");
      return;
    }
    setPending(true);
    const res = await fetch("/api/business/wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: value }),
    });
    setPending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Top-up failed.");
      return;
    }
    setAmount("");
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="rounded-card border border-default bg-surface-raised p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-subtle text-accent">
            <Wallet className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm text-secondary">Wallet balance</p>
            <p className="text-2xl font-extrabold tracking-tight text-primary">{inr(balance)}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-btn bg-accent px-4 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition hover:bg-accent-hover"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add funds
        </button>
      </div>

      {open && (
        <form onSubmit={addFunds} className="mt-5 border-t border-default pt-5">
          <div className="flex flex-wrap gap-2">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setAmount(String(q))}
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                  Number(amount) === q
                    ? "border-accent bg-accent-subtle text-accent"
                    : "border-default bg-surface text-secondary hover:bg-surface-sunken"
                }`}
              >
                {inr(q)}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[12rem]">
              <label htmlFor="amount" className="mb-1.5 block text-sm font-medium text-primary">
                Amount (₹)
              </label>
              <input
                id="amount"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1000"
                className="w-full rounded-btn border border-default bg-surface px-3 py-2.5 text-primary outline-none transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/50"
              />
            </div>
            <button
              type="submit"
              disabled={pending}
              className="rounded-btn bg-accent px-5 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition hover:bg-accent-hover disabled:opacity-60"
            >
              {pending ? "Adding…" : "Add to wallet"}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          <p className="mt-2 text-xs text-muted">
            Payment gateway is disabled for now — funds are added directly and credited instantly.
          </p>
        </form>
      )}

      {/* Recent transactions */}
      {transactions.length > 0 && (
        <div className="mt-5 border-t border-default pt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Recent transactions</p>
          <ul className="mt-3 divide-y divide-default">
            {transactions.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-secondary">
                  {t.note || (t.type === "topup" ? "Top-up" : t.type)}
                  <span className="ml-2 text-xs text-muted">{new Date(t.at).toLocaleDateString("en-IN")}</span>
                </span>
                <span className={t.amount >= 0 ? "font-semibold text-verified" : "font-semibold text-danger"}>
                  {t.amount >= 0 ? "+" : "−"}
                  {inr(Math.abs(t.amount))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
