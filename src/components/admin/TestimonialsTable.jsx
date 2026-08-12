"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Inbox, Star, Trash2 } from "lucide-react";
import { toast } from "../../lib/toast";
import SearchInput from "./SearchInput";

const STATUS_STYLES = {
  approved: "pill-verified",
  pending: "pill-pending",
  rejected: "pill-danger",
};

function Avatar({ name, avatarUrl }) {
  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={name}
        width={32}
        height={32}
        className="h-8 w-8 shrink-0 rounded-full border border-default object-cover"
      />
    );
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-xs font-bold text-accent">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function Rating({ value }) {
  return (
    <div className="flex gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((s) => (
        <Star
          key={s}
          className={`h-3.5 w-3.5 ${s < value ? "fill-amber-400 text-amber-400" : "text-muted"}`}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

function DeleteButton({ id, busy, confirming, onConfirm, onCancel, onDelete }) {
  if (confirming) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onDelete(id)}
          disabled={busy}
          className="rounded-btn bg-danger px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Deleting…" : "Confirm"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-btn border border-default bg-surface px-3 py-2 text-xs font-semibold text-secondary transition-colors duration-200 hover:bg-surface-sunken"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onConfirm}
      aria-label="Delete"
      title="Delete"
      className="inline-flex items-center justify-center rounded-btn border border-default bg-surface p-2 text-danger transition-colors duration-150 hover:bg-danger-subtle"
    >
      <Trash2 className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

/**
 * Testimonials table for /admin/testimonials — same shape as ContactsTable
 * (search filters already-fetched rows, desktop table / mobile cards) plus
 * BlogPostList's inline-confirm delete, since these are the only two
 * capabilities this queue needs: review what visitors submitted, and remove
 * anything spammy or wrong before it embarrasses the site.
 */
export default function TestimonialsTable({ rows: initialRows }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.role ?? "").toLowerCase().includes(q) ||
        t.quote.toLowerCase().includes(q)
    );
  }, [rows, query]);

  async function remove(id) {
    setBusyId(id);
    const res = await fetch(`/api/admin/testimonials/${id}`, { method: "DELETE" });
    setBusyId(null);
    setConfirmingId(null);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Couldn't delete the review.");
      return;
    }
    setRows((prev) => prev.filter((t) => t.id !== id)); // optimistic, no full refetch needed
    toast.success("Review deleted.");
    router.refresh();
  }

  return (
    <div className="mt-6">
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search by name, role, or review text"
        resultLabel={query ? `${filtered.length} of ${rows.length} reviews` : `${rows.length} shown`}
      />

      {filtered.length === 0 ? (
        <div className="mt-6 rounded-card border border-dashed border-default bg-surface-raised p-10 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-sunken">
            <Inbox className="h-6 w-6 text-muted" aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm font-semibold text-primary">
            {query ? `No reviews match "${query}"` : "No reviews yet"}
          </p>
          <p className="mt-1 text-sm text-secondary">
            {query
              ? "Try a different spelling."
              : "Reviews submitted via the homepage \"Leave a review\" modal will show up here."}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="mt-6 hidden overflow-x-auto rounded-card border border-default bg-surface-raised shadow-sm sm:block">
            <table className="w-full text-sm">
              <thead className="border-b border-default bg-surface-sunken text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">Reviewer</th>
                  <th className="px-5 py-3 font-semibold">Rating</th>
                  <th className="px-5 py-3 font-semibold">Review</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Submitted</th>
                  <th className="px-5 py-3 font-semibold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {filtered.map((t) => (
                  <tr key={t.id} className="transition-colors hover:bg-surface-sunken/50">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={t.name} avatarUrl={t.avatarUrl} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-primary">{t.name}</p>
                          {t.role ? <p className="truncate text-xs text-muted">{t.role}</p> : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <Rating value={t.rating} />
                    </td>
                    <td className="max-w-sm px-5 py-3.5 text-secondary">
                      <p className="line-clamp-2">{t.quote}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[t.status] ?? "pill-accent"}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-muted">{t.date}</td>
                    <td className="px-5 py-3.5 text-right">
                      <DeleteButton
                        id={t.id}
                        busy={busyId === t.id}
                        confirming={confirmingId === t.id}
                        onConfirm={() => setConfirmingId(t.id)}
                        onCancel={() => setConfirmingId(null)}
                        onDelete={remove}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="mt-6 space-y-3 sm:hidden">
            {filtered.map((t) => (
              <li key={t.id} className="rounded-card border border-default bg-surface-raised p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={t.name} avatarUrl={t.avatarUrl} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-primary">{t.name}</p>
                      {t.role ? <p className="truncate text-xs text-muted">{t.role}</p> : null}
                    </div>
                  </div>
                  <span className={`shrink-0 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[t.status] ?? "pill-accent"}`}>
                    {t.status}
                  </span>
                </div>
                <div className="mt-2">
                  <Rating value={t.rating} />
                </div>
                <p className="mt-2 text-xs text-secondary">{t.quote}</p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-xs text-muted">{t.date}</span>
                  <DeleteButton
                    id={t.id}
                    busy={busyId === t.id}
                    confirming={confirmingId === t.id}
                    onConfirm={() => setConfirmingId(t.id)}
                    onCancel={() => setConfirmingId(null)}
                    onDelete={remove}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
