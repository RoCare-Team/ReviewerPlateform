"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCcw } from "lucide-react";
import { toast } from "../../lib/toast";

/**
 * Runs the paid-review recheck on demand (api/admin/review-recheck) instead of
 * waiting for the hourly cron.
 *
 * Worth a button because of how flagging is paced: a submission is only
 * flagged after two conclusive misses, and the cron won't look at the same one
 * twice in a day. So right after the first pass every removed review sits at
 * one miss and this page reads "nothing to decide" for 24 hours. This does the
 * next pass now.
 *
 * The sweep is time-boxed server-side, so a big backlog comes back with
 * `done: false` — the summary says so and the button can just be pressed
 * again, rather than the request hanging until it times out.
 */
export default function RecheckNowButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState("");

  async function run() {
    setBusy(true);
    setSummary("");
    const res = await fetch("/api/admin/review-recheck", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      toast.error(data.error ?? "Couldn't run the check.");
      return;
    }

    if (data.checked === 0) {
      setSummary("Nothing left to check right now — every paid review has just been looked at.");
      toast.success("Everything is already up to date.");
      router.refresh();
      return;
    }

    const parts = [`${data.checked} checked`, `${data.present} still live`];
    if (data.reversed) parts.push(`${data.reversed} reversed automatically (₹${data.reclaimed} taken back)`);
    if (data.restored) parts.push(`${data.restored} credited back — the review returned`);
    if (data.missing) parts.push(`${data.missing} flagged for you`);
    if (data.inconclusive) parts.push(`${data.inconclusive} couldn't be confirmed`);
    setSummary(
      `${parts.join(" · ")}. ${data.flagged} waiting on a decision.` +
        (data.done ? "" : " More still to check — press again.")
    );
    toast.success(`${data.checked} reviews re-checked.`);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-btn bg-accent px-4 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition-all duration-200 hover:bg-accent-hover disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <RefreshCcw className="h-4 w-4" aria-hidden="true" />
        )}
        {busy ? "Checking Google…" : "Check now"}
      </button>
      {summary && <p className="text-sm text-secondary">{summary}</p>}
    </div>
  );
}
