"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

/**
 * Triggers a live fetch of reviews from Google for every connected account, then
 * refreshes the page so the newly-synced reviews render. Calls the real
 * /api/business/gmb/sync route (one call per connection).
 */
export default function SyncReviewsButton({ connectionIds }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function syncAll() {
    setBusy(true);
    setMsg(null);
    let synced = 0;
    const errors = [];

    for (const id of connectionIds) {
      const res = await fetch("/api/business/gmb/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) errors.push(data.error ?? "Sync failed");
      else {
        synced += data.synced ?? 0;
        if (data.errors?.length) errors.push(...data.errors);
      }
    }

    setBusy(false);
    setMsg(
      errors.length
        ? { tone: "error", text: `Synced ${synced} review(s). ${errors.length} issue(s): ${errors[0]}` }
        : { tone: "ok", text: `Synced ${synced} review(s).` }
    );
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={syncAll}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-btn bg-accent px-4 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition hover:bg-accent-hover disabled:opacity-60"
      >
        <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} aria-hidden="true" />
        {busy ? "Syncing…" : "Sync reviews"}
      </button>
      {msg && (
        <span className={`text-xs font-medium ${msg.tone === "ok" ? "text-verified" : "text-danger"}`}>
          {msg.text}
        </span>
      )}
    </div>
  );
}
