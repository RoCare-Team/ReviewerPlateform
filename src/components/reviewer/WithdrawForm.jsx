"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Building2, CreditCard, Hash, IndianRupee, Landmark } from "lucide-react";
import { Label, Input, FieldError, FormError } from "../auth/Field";

const STATUS_STYLES = {
  pending: "pill-pending",
  approved: "pill-verified",
  rejected: "pill-danger",
};

function inr(n) {
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

/**
 * Withdrawal request form + history. The bank fields are always shown
 * pre-filled from the last-saved details (if any) — the reviewer can submit
 * as-is to reuse them, or change any field to update them; POST persists
 * whatever was submitted as the new saved details either way.
 */
export default function WithdrawForm({ balance, minWithdrawal, bankDetails, hasPending, history }) {
  const router = useRouter();
  const [values, setValues] = useState({
    amount: "",
    accountHolderName: bankDetails.accountHolderName,
    accountNumber: bankDetails.accountNumber,
    ifsc: bankDetails.ifsc,
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [done, setDone] = useState(false);

  function set(key) {
    return (e) => {
      let value = key === "ifsc" ? e.target.value.toUpperCase() : e.target.value;
      // Amount: block anything that would exceed the wallet balance right as
      // it's typed, not just on submit — clamp to the balance instead of
      // letting an out-of-range number sit in the field.
      if (key === "amount" && value !== "") {
        const n = Number(value);
        if (Number.isNaN(n)) return;
        if (n > balance) value = String(balance);
        if (n < 0) value = "0";
      }
      setValues((v) => ({ ...v, [key]: value }));
    };
  }

  const amountNum = Number(values.amount);
  const amountError =
    values.amount === ""
      ? ""
      : !Number.isInteger(amountNum) || amountNum <= 0
        ? "Enter a valid amount in rupees."
        : amountNum > balance
          ? "You can't withdraw more than your wallet balance."
          : amountNum < minWithdrawal
            ? `Minimum withdrawal is ${inr(minWithdrawal)}.`
            : "";

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setDone(false);

    if (values.amount === "" || amountError) {
      setError(amountError || "Enter a valid amount in rupees.");
      return;
    }
    const amount = amountNum;

    setPending(true);
    const res = await fetch("/api/reviewer/withdrawals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        accountHolderName: values.accountHolderName,
        accountNumber: values.accountNumber,
        ifsc: values.ifsc,
      }),
    });
    setPending(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.details) setFieldErrors(data.details);
      else setError(data.error ?? "Couldn't submit the request.");
      return;
    }

    setValues((v) => ({ ...v, amount: "" }));
    setDone(true);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-card border border-default bg-surface-raised p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-bold text-primary">
          <Landmark className="h-4.5 w-4.5 text-accent" aria-hidden="true" />
          Request a withdrawal
        </h2>

        {hasPending ? (
          <p className="mt-4 rounded-btn border border-pending bg-pending-subtle px-3.5 py-3 text-sm leading-relaxed text-primary">
            You already have a withdrawal request awaiting review. You can submit another once
            it&apos;s approved or rejected.
          </p>
        ) : balance <= 0 ? (
          <p className="mt-4 text-sm text-secondary">
            Your wallet balance is ₹0 — complete verified reviews to earn a balance you can withdraw.
          </p>
        ) : balance < minWithdrawal ? (
          <p className="mt-4 text-sm text-secondary">
            Your wallet balance ({inr(balance)}) is below the minimum withdrawal of{" "}
            {inr(minWithdrawal)} — earn a bit more to be able to request a payout.
          </p>
        ) : (
          <form onSubmit={onSubmit} noValidate className="mt-5">
            <FormError>{error}</FormError>

            <div className="space-y-4">
              <div>
                <Label htmlFor="amount">Amount to withdraw (₹)</Label>
                <Input
                  id="amount"
                  type="number"
                  min={minWithdrawal}
                  max={balance}
                  step="1"
                  inputMode="numeric"
                  value={values.amount}
                  onChange={set("amount")}
                  placeholder={`Up to ${inr(balance)}`}
                  icon={IndianRupee}
                  required
                  error={amountError}
                />
                <FieldError id="amount-error">{amountError}</FieldError>
                {!amountError && (
                  <p className="mt-1.5 text-xs text-muted">
                    Available balance: {inr(balance)}. Minimum withdrawal: {inr(minWithdrawal)}.
                  </p>
                )}
              </div>

              <div className="border-t border-default pt-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Bank account</p>
                <p className="mt-1 text-xs text-muted">
                  {bankDetails.accountNumber
                    ? "Pre-filled from your saved details — edit any field to update them."
                    : "First withdrawal — these details are saved for next time."}
                </p>

                <div className="mt-3 space-y-4">
                  <div>
                    <Label htmlFor="accountHolderName">Account holder name</Label>
                    <Input
                      id="accountHolderName"
                      value={values.accountHolderName}
                      onChange={set("accountHolderName")}
                      placeholder="e.g. Ramesh Kumar"
                      icon={Building2}
                      required
                      error={fieldErrors.accountHolderName?.[0]}
                    />
                    <FieldError id="accountHolderName-error">{fieldErrors.accountHolderName?.[0]}</FieldError>
                  </div>

                  <div>
                    <Label htmlFor="accountNumber">Account number</Label>
                    <Input
                      id="accountNumber"
                      value={values.accountNumber}
                      onChange={set("accountNumber")}
                      inputMode="numeric"
                      placeholder="e.g. 123456789012"
                      icon={CreditCard}
                      required
                      error={fieldErrors.accountNumber?.[0]}
                    />
                    <FieldError id="accountNumber-error">{fieldErrors.accountNumber?.[0]}</FieldError>
                  </div>

                  <div>
                    <Label htmlFor="ifsc">IFSC code</Label>
                    <Input
                      id="ifsc"
                      value={values.ifsc}
                      onChange={set("ifsc")}
                      placeholder="SBIN0001234"
                      icon={Hash}
                      required
                      className="font-mono uppercase tracking-widest"
                      error={fieldErrors.ifsc?.[0]}
                    />
                    <FieldError id="ifsc-error">{fieldErrors.ifsc?.[0]}</FieldError>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-4">
              <button
                type="submit"
                disabled={pending || values.amount === "" || Boolean(amountError)}
                className="inline-flex items-center gap-2 rounded-btn bg-accent px-5 py-2.5 font-semibold text-on-brand shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                <Banknote className="h-4 w-4" aria-hidden="true" />
                {pending ? "Submitting…" : "Request withdrawal"}
              </button>
              {done && <span className="text-sm font-medium text-verified">Request submitted.</span>}
            </div>
          </form>
        )}
      </div>

      {/* History */}
      <div className="rounded-card border border-default bg-surface-raised p-6 shadow-sm">
        <h2 className="text-base font-bold text-primary">Request history</h2>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-secondary">No withdrawal requests yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-default">
            {history.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="nums text-sm font-bold text-primary">{inr(r.amount)}</p>
                  <p className="text-xs text-muted">
                    A/C ···{r.accountNumber.slice(-4)} · {new Date(r.createdAt).toLocaleDateString("en-IN")}
                  </p>
                  {r.status === "rejected" && r.rejectionReason && (
                    <p className="mt-1 text-xs text-danger">Rejected: {r.rejectionReason}</p>
                  )}
                </div>
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[r.status]}`}>
                  {r.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
