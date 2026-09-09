"use client";

import { useMemo, useState } from "react";
import { Inbox } from "lucide-react";
import SearchInput from "./SearchInput";

/**
 * The wallet ledger for /admin/finance — every rupee that moved into or out of
 * a wallet, newest first, filterable by type and searchable by whose wallet it
 * was.
 *
 * Rows are already fetched (the page caps at 500), so both filters run in the
 * browser — same trade-off, and the same caveat, as the other admin tables:
 * this searches the fetched page, not the whole ledger.
 *
 * Amounts are shown signed, because the sign IS the meaning here: a deposit
 * and a campaign spend are the same `amount` field pointing opposite ways.
 */
const TABS = [
  { key: "all", label: "All" },
  { key: "topup", label: "Deposits" },
  { key: "spend", label: "Campaign spend" },
  { key: "reward", label: "Rewards" },
  { key: "withdrawal", label: "Withdrawals" },
  { key: "refund", label: "Refunds" },
  { key: "referral", label: "Referral" },
];

export default function TransactionLedger({ rows }) {
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const c = { all: rows.length };
    for (const t of TABS) if (t.key !== "all") c[t.key] = rows.filter((r) => r.type === t.key).length;
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const base = tab === "all" ? rows : rows.filter((r) => r.type === tab);
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((r) => [r.userName, r.userEmail, r.note].some((v) => (v || "").toLowerCase().includes(q)));
  }, [rows, tab, query]);

  // The total of what's on screen, not of the whole ledger — an admin who has
  // filtered to "Deposits, this business" wants that subtotal, and a number
  // that ignored the filters would be actively misleading.
  const shownTotal = visible.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div>
      <div role="tablist" aria-label="Filter transactions by type" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
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
                {counts[t.key] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Name, email or note…"
        resultLabel={`${visible.length} shown · net ${shownTotal < 0 ? "−" : "+"}₹${Math.abs(shownTotal).toLocaleString("en-IN")}`}
      />

      {visible.length === 0 ? (
        <div className="mt-6 rounded-card border border-dashed border-default bg-surface-raised p-10 text-center">
          <Inbox className="mx-auto h-8 w-8 text-muted" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-primary">No transactions match</p>
          <p className="mt-1 text-sm text-secondary">Try another type, or clear the search.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="mt-6 hidden overflow-x-auto rounded-card border border-default bg-surface-raised shadow-sm sm:block">
            <table className="w-full text-sm">
              <thead className="border-b border-default bg-surface-sunken text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">When</th>
                  <th className="px-5 py-3 font-semibold">Wallet</th>
                  <th className="px-5 py-3 font-semibold">Type</th>
                  <th className="px-5 py-3 font-semibold">Note</th>
                  <th className="px-5 py-3 text-right font-semibold">Amount</th>
                  <th className="px-5 py-3 text-right font-semibold">Balance after</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {visible.map((t) => (
                  <tr key={t.id} className="transition-colors hover:bg-surface-sunken/50">
                    <td className="whitespace-nowrap px-5 py-3.5 text-muted">{t.date}</td>
                    <td className="px-5 py-3.5">
                      <p className="truncate font-semibold text-primary">{t.userName || t.userEmail || "Deleted user"}</p>
                      <p className="truncate text-xs text-muted">{t.roleLabel}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="pill-accent">{t.typeLabel}</span>
                      {t.byAdmin && <span className="ml-1.5 text-xs text-muted">by admin</span>}
                    </td>
                    <td className="max-w-xs px-5 py-3.5 text-secondary">
                      <p className="line-clamp-2">{t.note || "—"}</p>
                    </td>
                    <td className={`nums whitespace-nowrap px-5 py-3.5 text-right font-bold ${t.amount < 0 ? "text-danger" : "text-verified"}`}>
                      {t.amount < 0 ? "−" : "+"}₹{Math.abs(t.amount).toLocaleString("en-IN")}
                    </td>
                    <td className="nums whitespace-nowrap px-5 py-3.5 text-right text-secondary">
                      ₹{Number(t.balanceAfter || 0).toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="mt-6 space-y-3 sm:hidden">
            {visible.map((t) => (
              <li key={t.id} className="rounded-card border border-default bg-surface-raised p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-primary">{t.userName || t.userEmail || "Deleted user"}</p>
                    <p className="mt-0.5 text-xs text-muted">{t.date}</p>
                  </div>
                  <span className={`nums shrink-0 font-bold ${t.amount < 0 ? "text-danger" : "text-verified"}`}>
                    {t.amount < 0 ? "−" : "+"}₹{Math.abs(t.amount).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="pill-accent">{t.typeLabel}</span>
                  <span className="nums text-xs text-muted">balance ₹{Number(t.balanceAfter || 0).toLocaleString("en-IN")}</span>
                </div>
                {t.note && <p className="mt-2 text-sm text-secondary">{t.note}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
