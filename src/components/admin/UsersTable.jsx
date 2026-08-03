"use client";

import { useMemo, useState } from "react";
import SearchInput from "./SearchInput";

/**
 * Users table for /admin/users. Rows arrive serialized from the server; this
 * component owns the search box only.
 *
 * Search is separate from the role tabs on purpose: the tabs re-query the
 * server (they're links, and survive a reload), while search filters what is
 * already on screen. Searching within "Reviewers" therefore searches reviewers.
 */

const ROLE_LABEL = { business_owner: "Business", reviewer: "Reviewer", admin: "Admin" };
const ROLE_STYLE = { business_owner: "pill-accent", reviewer: "pill-verified", admin: "pill-pending" };
const STATUS_STYLE = { active: "pill-verified", pending: "pill-pending", suspended: "pill-danger" };

export default function UsersTable({ rows }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [rows, query]);

  return (
    <>
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search by name or email"
        resultLabel={
          query ? `${filtered.length} of ${rows.length} users` : `${rows.length} shown`
        }
      />

      {filtered.length === 0 ? (
        <div className="mt-6 rounded-card border border-dashed border-default bg-surface-raised p-10 text-center">
          <p className="text-sm font-semibold text-primary">No users match “{query}”</p>
          <p className="mt-1 text-sm text-secondary">
            Try a different spelling, or switch role tab — search only covers the current tab.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="mt-6 hidden overflow-x-auto rounded-card border border-default bg-surface-raised shadow-sm sm:block">
            <table className="w-full text-sm">
              <thead className="border-b border-default bg-surface-sunken text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">User</th>
                  <th className="px-5 py-3 font-semibold">Role</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Wallet</th>
                  <th className="px-5 py-3 font-semibold">Joined</th>
                  <th className="px-5 py-3 font-semibold">Last login</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {filtered.map((u) => (
                  <tr key={u.id} className="transition-colors hover:bg-surface-sunken/50">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-xs font-bold text-accent">
                          {(u.name || u.email || "?").charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-primary">{u.name || "—"}</p>
                          <p className="truncate text-xs text-muted">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          ROLE_STYLE[u.role] ?? "pill-accent"
                        }`}
                      >
                        {ROLE_LABEL[u.role] ?? u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                          STATUS_STYLE[u.status] ?? "pill-accent"
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="nums px-5 py-3.5 font-semibold text-primary">{u.walletDisplay}</td>
                    <td className="px-5 py-3.5 text-muted">{u.joined}</td>
                    <td className="px-5 py-3.5 text-muted">{u.lastLogin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="mt-6 space-y-3 sm:hidden">
            {filtered.map((u) => (
              <li key={u.id} className="rounded-card border border-default bg-surface-raised p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate font-semibold text-primary">{u.name || u.email}</p>
                  <span
                    className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      ROLE_STYLE[u.role] ?? "pill-accent"
                    }`}
                  >
                    {ROLE_LABEL[u.role] ?? u.role}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-muted">{u.email}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-secondary">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 font-semibold capitalize ${
                      STATUS_STYLE[u.status] ?? "pill-accent"
                    }`}
                  >
                    {u.status}
                  </span>
                  <span className="nums font-semibold text-primary">{u.walletDisplay}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
