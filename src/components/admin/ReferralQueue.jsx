"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Gift, Globe, Inbox, Smartphone, X } from "lucide-react";
import SearchInput from "./SearchInput";
import { toast } from "../../lib/toast";

/**
 * Admin referral queue — same tabs/approve/reject shape as WithdrawalQueue,
 * over referrals instead of payouts.
 *
 * Each row is one REFERRED account (that's where a referral is stored, see
 * models/User.js), showing the two things a decision actually turns on: did
 * this account reach the app, and has the referrer been paid. Approving
 * credits the referrer's wallet now; rejecting settles it for good, including
 * against a later install.
 */
const STATUS_STYLES = {
  paid: "pill-verified",
  pending: "pill-pending",
  rejected: "pill-danger",
};

const STATUS_LABEL = {
  paid: "Approved · credited",
  pending: "Not approved yet",
  rejected: "Rejected",
};

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "paid", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

export default function ReferralQueue({ rows, reward }) {
  const router = useRouter();
  const [tab, setTab] = useState("pending");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState("");

  const counts = {
    pending: rows.filter((r) => r.status === "pending").length,
    paid: rows.filter((r) => r.status === "paid").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
    all: rows.length,
  };

  // Search runs across both sides of the referral — an admin chasing a
  // specific complaint has either the referrer's code/number or the new
  // user's, rarely both.
  const visible = useMemo(() => {
    const base = tab === "all" ? rows : rows.filter((r) => r.status === tab);
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((r) =>
      [r.name, r.phone, r.referrerName, r.referrerPhone, r.referrerCode]
        .some((v) => (v || "").toLowerCase().includes(q))
    );
  }, [rows, tab, query]);

  async function act(id, action, reasonText = "") {
    setBusy(id);
    const res = await fetch(`/api/admin/referrals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason: reasonText }),
    });
    setBusy(null);
    setRejecting(null);
    setReason("");

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Couldn't update this referral.");
      router.refresh();
      return;
    }

    toast.success(action === "approve" ? `₹${reward} credited to the referrer.` : "Referral rejected.");
    router.refresh();
  }

  return (
    <div>
      <div role="tablist" aria-label="Filter referrals by status" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
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

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Name, phone or referral code…"
        resultLabel={query ? `${visible.length} match${visible.length === 1 ? "" : "es"}` : ""}
      />

      <div className="mt-6">
        {visible.length === 0 ? (
          <div className="animate-fade-up rounded-card border border-dashed border-default bg-surface-raised p-12 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-verified-subtle">
              <Inbox className="h-6 w-6 text-verified" aria-hidden="true" />
            </span>
            <p className="mt-4 text-sm font-semibold text-primary">
              {tab === "pending" ? "Nothing waiting" : "Nothing here yet"}
            </p>
            <p className="mt-1 text-sm text-secondary">
              {tab === "pending"
                ? "Every referral has been credited or settled."
                : "Referrals show up here as people join with a code."}
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
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-primary">{r.name}</p>
                      {r.phone && <span className="nums text-sm text-secondary">{r.phone}</span>}
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[r.status] ?? "pill-accent"}`}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                      {r.installedApp ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-verified-subtle px-2 py-0.5 text-[11px] font-bold text-verified">
                          <Smartphone className="h-3 w-3" aria-hidden="true" />
                          On the app
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-bold text-muted">
                          <Globe className="h-3 w-3" aria-hidden="true" />
                          Not seen on the app
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      Joined {r.joined} · signed up on {r.signupSource}
                      {r.installedAt ? ` · app first seen ${r.installedAt}` : ""}
                    </p>
                  </div>
                  <p className="nums shrink-0 text-lg font-bold text-primary">₹{reward}</p>
                </div>

                <div className="mt-3 rounded-btn border border-default bg-surface p-3.5 text-sm">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                    <Gift className="h-3 w-3" aria-hidden="true" />
                    Referred by
                  </p>
                  <p className="mt-0.5 font-semibold text-primary">
                    {r.referrerName}
                    {r.referrerPhone && <span className="nums font-normal text-secondary"> · {r.referrerPhone}</span>}
                    {r.referrerCode && <span className="nums font-normal text-muted"> · code {r.referrerCode}</span>}
                  </p>
                </div>

                {r.status === "paid" && (
                  <p className="mt-3 text-xs font-semibold text-verified">
                    Credited{r.paidAt ? ` · ${r.paidAt}` : ""}
                    {r.manual ? " · approved by an admin" : " · automatic (app install)"}
                  </p>
                )}
                {r.status === "rejected" && (
                  <p className="mt-3 text-xs text-danger">
                    Rejected{r.rejectedAt ? ` · ${r.rejectedAt}` : ""}
                    {r.note ? ` — ${r.note}` : ""}
                  </p>
                )}
                {r.status === "paid" && r.note && <p className="mt-1 text-xs text-muted">{r.note}</p>}

                {r.status !== "paid" && (
                  rejecting === r.id ? (
                    <div className="mt-4 animate-fade-up" style={{ animationDuration: "200ms" }}>
                      <input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Reason (admin-only)…"
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
                          Confirm reject
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
                        {busy === r.id ? "Working…" : `Approve & credit ₹${reward}`}
                      </button>
                      {r.status === "pending" && (
                        <button
                          type="button"
                          onClick={() => setRejecting(r.id)}
                          disabled={busy === r.id}
                          className="inline-flex items-center gap-1.5 rounded-btn border border-default bg-surface px-4 py-2 text-sm font-semibold text-danger transition-all duration-200 hover:-translate-y-0.5 hover:bg-danger-subtle hover:shadow-md disabled:opacity-60 disabled:hover:translate-y-0"
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                          Reject
                        </button>
                      )}
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
