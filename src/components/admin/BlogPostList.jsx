"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, ExternalLink, Inbox, Pencil, Trash2 } from "lucide-react";
import { toast } from "../../lib/toast";

const STATUS_STYLES = { published: "pill-verified", draft: "pill-pending" };

export default function BlogPostList({ posts }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);

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
      {posts.map((post) => (
        <li
          key={post.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-default bg-surface-raised p-4 shadow-sm transition-all duration-200 hover:border-accent/30 hover:shadow-md sm:p-5"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[post.status]}`}>
                {post.status}
              </span>
              <span className="text-xs font-medium text-muted">{post.category}</span>
            </div>
            <p className="mt-1.5 truncate text-base font-bold text-primary">{post.title}</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {post.readMinutes} min read · /blog/{post.slug}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {post.status === "published" && (
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
        </li>
      ))}
    </ul>
  );
}
