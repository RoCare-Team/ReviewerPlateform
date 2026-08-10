"use client";

import { useMemo, useState } from "react";
import SearchInput from "./SearchInput";

/**
 * Contact-form submissions table for /admin/contacts. Same shape as
 * UsersTable: search filters the already-fetched rows client-side, desktop
 * gets a real table, mobile gets stacked cards.
 */
export default function ContactsTable({ rows }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q)
    );
  }, [rows, query]);

  return (
    <div className="mt-6">
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search by name, email, or phone"
        resultLabel={
          query ? `${filtered.length} of ${rows.length} requests` : `${rows.length} shown`
        }
      />

      {filtered.length === 0 ? (
        <div className="mt-6 rounded-card border border-dashed border-default bg-surface-raised p-10 text-center">
          <p className="text-sm font-semibold text-primary">
            {query ? `No requests match "${query}"` : "No contact requests yet"}
          </p>
          <p className="mt-1 text-sm text-secondary">
            {query
              ? "Try a different spelling."
              : "Submissions from the \"Book a demo\" form will show up here."}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="mt-6 hidden overflow-x-auto rounded-card border border-default bg-surface-raised shadow-sm sm:block">
            <table className="w-full text-sm">
              <thead className="border-b border-default bg-surface-sunken text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">Name</th>
                  <th className="px-5 py-3 font-semibold">Email</th>
                  <th className="px-5 py-3 font-semibold">Phone</th>
                  <th className="px-5 py-3 font-semibold">Message</th>
                  <th className="px-5 py-3 font-semibold">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {filtered.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-surface-sunken/50">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-xs font-bold text-accent">
                          {c.name.charAt(0).toUpperCase()}
                        </span>
                        <p className="truncate font-semibold text-primary">{c.name}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-secondary">{c.email}</td>
                    <td className="nums px-5 py-3.5 text-secondary">{c.phone}</td>
                    <td className="max-w-xs px-5 py-3.5 text-secondary">
                      <p className="line-clamp-2">{c.description}</p>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-muted">{c.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="mt-6 space-y-3 sm:hidden">
            {filtered.map((c) => (
              <li key={c.id} className="rounded-card border border-default bg-surface-raised p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate font-semibold text-primary">{c.name}</p>
                  <span className="shrink-0 text-xs text-muted">{c.date}</span>
                </div>
                <p className="mt-1 truncate text-xs text-muted">{c.email}</p>
                <p className="nums mt-1 text-xs text-muted">{c.phone}</p>
                <p className="mt-2 text-xs text-secondary">{c.description}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
