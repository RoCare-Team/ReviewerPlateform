"use client";

import { useMemo, useState } from "react";
import SearchInput from "./SearchInput";
import AddFundsForm from "./AddFundsForm";

/**
 * Businesses table for /admin/organisations. Rows are serialized on the server;
 * this component owns the search box only.
 *
 * Adding funds opens a modal rather than expanding the row — a money form
 * squeezed into a table cell is unusable, and an expanding row shifts every
 * row below it while an admin is typing an amount.
 */

const STATUS_STYLE = {
  active: "pill-verified",
  pending: "pill-pending",
  suspended: "pill-danger",
};

function StatusPill({ status }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
        STATUS_STYLE[status] ?? "pill-accent"
      }`}
    >
      {status}
    </span>
  );
}

function Progress({ collected, target }) {
  if (!target) return <span className="text-muted">—</span>;
  const pct = Math.min(100, Math.round((collected / target) * 100));
  return (
    <div className="min-w-28">
      <p className="nums text-xs font-medium text-secondary">
        {collected}/{target}
      </p>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function OrganisationsTable({ rows }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    // Name, email AND phone, so an admin can paste any of them from a support ticket.
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.email || "").toLowerCase().includes(q) ||
        (r.phone || "").toLowerCase().includes(q)
    );
  }, [rows, query]);

  return (
    <>
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search by business name or email"
        resultLabel={
          query
            ? `${filtered.length} of ${rows.length} businesses`
            : `${rows.length} business${rows.length === 1 ? "" : "es"}`
        }
      />

      {filtered.length === 0 ? (
        <div className="mt-6 rounded-card border border-dashed border-default bg-surface-raised p-10 text-center">
          <p className="text-sm font-semibold text-primary">No businesses match “{query}”</p>
          <p className="mt-1 text-sm text-secondary">Check the spelling, or clear the search.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="mt-6 hidden overflow-x-auto rounded-card border border-default bg-surface-raised shadow-sm md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-default bg-surface-sunken text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">Business</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Campaigns</th>
                  <th className="px-5 py-3 font-semibold">Reviews</th>
                  <th className="px-5 py-3 font-semibold">Locations</th>
                  <th className="px-5 py-3 font-semibold">Progress</th>
                  <th className="px-5 py-3 font-semibold">Wallet</th>
                  <th className="px-5 py-3 font-semibold">Joined</th>
                  <th className="px-5 py-3 text-right font-semibold">Funds</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {filtered.map((b) => (
                    <tr key={b.id} className="transition-colors hover:bg-surface-sunken/50">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-xs font-bold text-accent">
                            {b.name.charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-primary">{b.name}</p>
                            <p className="truncate text-xs text-muted">{b.email}</p>
                            <p className="nums truncate text-xs text-muted">{b.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusPill status={b.status} />
                      </td>
                      <td className="nums px-5 py-3.5 text-primary">
                        {b.total}
                        <span className="ml-1 text-xs text-muted">({b.active} active)</span>
                      </td>
                      <td className="nums px-5 py-3.5 text-primary">{b.reviews}</td>
                      <td className="nums px-5 py-3.5 text-primary">
                        {b.locations}
                        <span className="ml-1 text-xs text-muted">({b.gmbAccounts} GMB)</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <Progress collected={b.collected} target={b.target} />
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="nums font-semibold text-primary">{b.walletDisplay}</p>
                        <p className="nums text-xs text-muted">{b.spendDisplay} spent</p>
                      </td>
                      <td className="px-5 py-3.5 text-muted">{b.joined}</td>
                      <td className="px-5 py-3.5 text-right">
                        {b.status === "active" ? (
                          <AddFundsForm
                            businessId={b.id}
                            businessName={b.name}
                            walletDisplay={b.walletDisplay}
                          />
                        ) : (
                          <span className="text-xs capitalize text-muted">{b.status}</span>
                        )}
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards — a 9-column table is unreadable on a phone. */}
          <ul className="mt-6 space-y-3 md:hidden">
            {filtered.map((b) => (
              <li key={b.id} className="rounded-card border border-default bg-surface-raised p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-primary">{b.name}</p>
                    <p className="truncate text-xs text-muted">{b.email}</p>
                    <p className="nums truncate text-xs text-muted">{b.phone}</p>
                  </div>
                  <StatusPill status={b.status} />
                </div>

                <dl className="nums mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <dt className="text-muted">Campaigns</dt>
                    <dd className="font-semibold text-primary">{b.total}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Reviews</dt>
                    <dd className="font-semibold text-primary">{b.reviews}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Locations</dt>
                    <dd className="font-semibold text-primary">{b.locations}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Wallet</dt>
                    <dd className="font-semibold text-primary">{b.walletDisplay}</dd>
                  </div>
                </dl>

                <div className="mt-3">
                  {b.status === "active" ? (
                    <AddFundsForm
                      businessId={b.id}
                      businessName={b.name}
                      walletDisplay={b.walletDisplay}
                    />
                  ) : (
                    <p className="text-xs text-muted">
                      Account is {b.status} — funds can only be added to active accounts.
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
