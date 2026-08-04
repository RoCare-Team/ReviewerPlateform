"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Check, CreditCard, Hash, Inbox, X } from "lucide-react";

const STATUS_STYLES = {
  approved: "pill-verified",
  pending: "pill-pending",
  rejected: "pill-danger",
};

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

function inr(n) {
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

/**
 * Admin withdrawal-request queue. Same tab pattern as VerificationQueue —
 * defaults to Pending, other tabs surface the full decided history. Approve
 * just records the payout as sent (manual, no gateway yet); reject refunds
 * the held amount back to the reviewer's wallet server-side.
 */
export default function WithdrawalQueue({ requests }) {
  const router = useRouter();
  const [tab, setTab] = useState("pending");
  const [busy, setBusy] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState("");

  const counts = {
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
    all: requests.length,
  };

  const visible = tab === "all" ? requests : requests.filter((r) => r.status === tab);

  async function act(id, action, reasonText = "") {
    setBusy(id);
    const res = await fetch(`/api/admin/withdrawals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason: reasonText }),
    });
    setBusy(null);
    setRejecting(null);
    setReason("");
    if (res.ok) router.refresh();
  }

  return (
    <div>
      <div role="tablist" aria-label="Filter withdrawals by status" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {TABS.map((t) => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setTab(t.key)}
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                isActive
                  ? "border-transparent bg-accent text-on-brand shadow-sm"
                  : "border-default bg-surface text-secondary hover:-translate-y-0.5 hover:border-accent/40 hover:text-primary"
              }`}
            >
              {t.label}
              <span className={`nums rounded-full px-1.5 py-0.5 text-xs transition-colors duration-200 ${isActive ? "bg-white/20" : "bg-surface-sunken"}`}>
                {counts[t.key]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {visible.length === 0 ? (
          <div className="animate-fade-up rounded-card border border-dashed border-default bg-surface-raised p-12 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-verified-subtle">
              <Inbox className="h-6 w-6 text-verified" aria-hidden="true" />
            </span>
            <p className="mt-4 text-sm font-semibold text-primary">
              {tab === "pending" ? "All caught up" : "Nothing here yet"}
            </p>
            <p className="mt-1 text-sm text-secondary">
              {tab === "pending"
                ? "No withdrawal requests waiting for review right now."
                : "Requests will show up here once there are some in this status."}
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {visible.map((r, i) => (
              <li
                key={r.id}
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                className="animate-fade-up rounded-card border border-default bg-surface-raised p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-md"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="nums text-lg font-extrabold text-primary">{inr(r.amount)}</p>
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[r.status] ?? "pill-accent"}`}>
                        {r.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      by {r.reviewerName || r.reviewerEmail} · {r.date}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 rounded-btn border border-default bg-surface p-3.5 text-sm sm:grid-cols-3">
                  <div>
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                      <Banknote className="h-3 w-3" aria-hidden="true" />
                      Account holder
                    </p>
                    <p className="mt-0.5 font-semibold text-primary">{r.accountHolderName}</p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                      <CreditCard className="h-3 w-3" aria-hidden="true" />
                      Account number
                    </p>
                    <p className="nums mt-0.5 font-semibold text-primary">{r.accountNumber}</p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                      <Hash className="h-3 w-3" aria-hidden="true" />
                      IFSC
                    </p>
                    <p className="nums mt-0.5 font-semibold text-primary">{r.ifsc}</p>
                  </div>
                </div>

                {r.status === "rejected" && r.rejectionReason && (
                  <p className="mt-3 text-xs text-danger">Rejected: {r.rejectionReason}</p>
                )}
                {r.status === "approved" && (
                  <p className="mt-3 text-xs font-semibold text-verified">
                    Marked paid{r.reviewedDate ? ` · ${r.reviewedDate}` : ""}
                  </p>
                )}

                {r.status === "pending" && (
                  rejecting === r.id ? (
                    <div className="mt-4 animate-fade-up" style={{ animationDuration: "200ms" }}>
                      <input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Reason for rejection…"
                        autoFocus
                        className="w-full rounded-btn border border-default bg-surface px-3 py-2 text-sm outline-none transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/50"
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => act(r.id, "reject", reason)}
                          disabled={busy === r.id}
                          className="rounded-btn bg-danger px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60 disabled:hover:translate-y-0"
                        >
                          Confirm reject &amp; refund
                        </button>
                        <button
                          type="button"
                          onClick={() => { setRejecting(null); setReason(""); }}
                          disabled={busy === r.id}
                          className="rounded-btn border border-default bg-surface px-3 py-1.5 text-sm font-semibold text-secondary transition-colors duration-200 hover:bg-surface-sunken"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => act(r.id, "approve")}
                        disabled={busy === r.id}
                        className="inline-flex items-center gap-1.5 rounded-btn bg-verified px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60 disabled:hover:translate-y-0"
                      >
                        <Check className="h-4 w-4" aria-hidden="true" />
                        {busy === r.id ? "Working…" : "Mark paid"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRejecting(r.id)}
                        disabled={busy === r.id}
                        className="inline-flex items-center gap-1.5 rounded-btn border border-default bg-surface px-4 py-2 text-sm font-semibold text-danger transition-all duration-200 hover:-translate-y-0.5 hover:bg-danger-subtle hover:shadow-md disabled:opacity-60 disabled:hover:translate-y-0"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                        Reject
                      </button>
                    </div>
                  )
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
