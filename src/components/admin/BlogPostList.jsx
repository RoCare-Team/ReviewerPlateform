"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, ExternalLink, Inbox, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "../../lib/toast";

const STATUS_STYLES = { published: "pill-verified", draft: "pill-pending" };

/** iOS-style switch. off = draft (left, muted), on = published (right, accent). */
function StatusToggle({ status, busy, onToggle }) {
  const isPublished = status === "published";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isPublished}
      aria-label={isPublished ? "Published — click to move to draft" : "Draft — click to publish"}
      onClick={onToggle}
      disabled={busy}
      className={`group inline-flex shrink-0 items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60`}
    >
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${
          isPublished ? "bg-verified" : "bg-default"
        }`}
      >
        <span
          className={`inline-flex h-4.5 w-4.5 items-center justify-center rounded-full bg-white shadow-sm transition-transform duration-200 ${
            isPublished ? "translate-x-6" : "translate-x-1"
          }`}
        >
          {busy && <Loader2 className="h-3 w-3 animate-spin text-muted" aria-hidden="true" />}
        </span>
      </span>
      <span className={`text-xs font-semibold capitalize ${isPublished ? "text-verified" : "text-secondary"}`}>
        {isPublished ? "Published" : "Draft"}
      </span>
    </button>
  );
}

export default function BlogPostList({ posts }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  // Optimistic status override, keyed by post id — keeps the toggle snappy
  // without waiting on router.refresh() to re-fetch the server list.
  const [statusOverride, setStatusOverride] = useState({});

  async function remove(id) {
    setBusyId(id);
    const res = await fetch(`/api/admin/blog/${id}`, { method: "DELETE" });
    setBusyId(null);
    setConfirmingId(null);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Couldn't delete the post.");
      return;
    }
    toast.success("Post deleted.");
    router.refresh();
  }

  async function toggleStatus(post) {
    const current = statusOverride[post.id] ?? post.status;
    const next = current === "published" ? "draft" : "published";

    setBusyId(post.id);
    setStatusOverride((m) => ({ ...m, [post.id]: next })); // optimistic

    const res = await fetch(`/api/admin/blog/${post.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setBusyId(null);

    if (!res.ok) {
      setStatusOverride((m) => ({ ...m, [post.id]: current })); // revert
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Couldn't update status.");
      return;
    }

    toast.success(next === "published" ? "Post published." : "Moved to draft.");
    router.refresh();
  }

  if (posts.length === 0) {
    return (
      <div className="mt-6 rounded-card border border-dashed border-default bg-surface-raised p-12 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-sunken">
          <Inbox className="h-6 w-6 text-muted" aria-hidden="true" />
        </span>
        <p className="mt-4 text-sm font-semibold text-primary">No posts yet</p>
        <p className="mt-1 text-sm text-secondary">Create your first post to get the blog started.</p>
      </div>
    );
  }

  return (
    <ul className="mt-6 space-y-3">
      {posts.map((post) => {
        const status = statusOverride[post.id] ?? post.status;
        return (
          <li
            key={post.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-default bg-surface-raised p-4 shadow-sm transition-all duration-200 hover:border-accent/30 hover:shadow-md sm:p-5"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[status]}`}>
                  {status}
                </span>
                <span className="text-xs font-medium text-muted">{post.category}</span>
              </div>
              <p className="mt-1.5 truncate text-base font-bold text-primary">{post.title}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {post.readMinutes} min read · /blog/{post.slug}
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <StatusToggle status={status} busy={busyId === post.id} onToggle={() => toggleStatus(post)} />

              <span className="h-5 w-px bg-default" aria-hidden="true" />

              <div className="flex items-center gap-2">
                {status === "published" && (
                  <Link
                    href={`/blog/${post.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="View live"
                    title="View live"
                    className="inline-flex items-center justify-center rounded-btn border border-default bg-surface p-2 text-secondary transition-colors duration-150 hover:bg-surface-sunken hover:text-primary"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </Link>
                )}
                <Link
                  href={`/admin/blog/${post.id}`}
                  aria-label="Edit"
                  title="Edit"
                  className="inline-flex items-center justify-center rounded-btn border border-default bg-surface p-2 text-secondary transition-colors duration-150 hover:bg-surface-sunken hover:text-primary"
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </Link>

                {confirmingId === post.id ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => remove(post.id)}
                      disabled={busyId === post.id}
                      className="rounded-btn bg-danger px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:opacity-90 disabled:opacity-60"
                    >
                      {busyId === post.id ? "Deleting…" : "Confirm"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(null)}
                      className="rounded-btn border border-default bg-surface px-3 py-2 text-xs font-semibold text-secondary transition-colors duration-200 hover:bg-surface-sunken"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingId(post.id)}
                    aria-label="Delete"
                    title="Delete"
                    className="inline-flex items-center justify-center rounded-btn border border-default bg-surface p-2 text-danger transition-colors duration-150 hover:bg-danger-subtle"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
