"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Reply, Send, X } from "lucide-react";
import { toast } from "../../lib/toast";

/**
 * Inline "Reply" form for a single Play Store review — posts the reply live
 * to Google via /api/business/playstore/reply. Mirrors ReplyToReview.jsx (GMB).
 */
export default function PlayStoreReplyToReview({ reviewId }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!text.trim()) return;

    setBusy(true);
    const res = await fetch("/api/business/playstore/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewId, text }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      toast.error(data.error ?? "Couldn't post the reply.");
      return;
    }

    toast.success("Reply posted to Play Store.");
    setOpen(false);
    setText("");
    router.refresh();
  }

  if (!open) {
    return (
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-btn border border-default bg-surface px-3 py-1.5 text-sm font-semibold text-primary transition hover:bg-surface-sunken"
        >
          <Reply className="h-4 w-4" aria-hidden="true" />
          Reply
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="animate-fade-up mt-4 border-t border-default pt-3.5" style={{ animationDuration: "200ms" }}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-primary">Reply to this review</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cancel reply"
          className="rounded-full p-1 text-muted transition-all duration-200 hover:scale-110 hover:bg-surface-sunken hover:text-primary"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <textarea
        rows={3}
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={350}
        disabled={busy}
        placeholder="Thank the reviewer or address their feedback… (max 350 characters — Play Store's limit)"
        className="mt-2.5 w-full rounded-2xl border border-default bg-surface px-3 py-2.5 text-sm text-primary outline-none transition-all duration-200 placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/50 disabled:opacity-60"
      />

      <div className="mt-2.5 flex items-center justify-between">
        <span className="text-xs text-muted">{text.length}/350</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={busy}
            className="rounded-btn border border-default bg-surface px-3.5 py-2 text-sm font-semibold text-secondary transition hover:bg-surface-sunken disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !text.trim()}
            className="inline-flex items-center gap-1.5 rounded-btn bg-accent px-3.5 py-2 text-sm font-semibold text-on-brand shadow-sm transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            {busy ? "Posting…" : "Post reply"}
          </button>
        </div>
      </div>
    </form>
  );
}
