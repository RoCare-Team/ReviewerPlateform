"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "../../lib/toast";

/**
 * Turns AI auto-reply on/off for all of this business's active GMB
 * connections. When on, the gmb-auto-reply cron drafts and posts a reply to
 * any new review that doesn't already have one — see
 * src/app/api/cron/gmb-auto-reply.
 */
export default function AutoReplyToggle({ enabled: initialEnabled }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !enabled;
    setBusy(true);
    const res = await fetch("/api/business/gmb/auto-reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    });
    setBusy(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Couldn't update auto-reply.");
      return;
    }

    setEnabled(next);
    toast.success(next ? "AI auto-reply turned on." : "AI auto-reply turned off.");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={enabled}
      title="Automatically post an AI-drafted reply to new reviews that don't have one yet."
      className={`inline-flex items-center gap-2 rounded-btn border px-4 py-2.5 text-sm font-semibold shadow-sm transition disabled:opacity-60 ${
        enabled
          ? "border-accent bg-accent-subtle text-accent"
          : "border-default bg-surface-raised text-secondary hover:bg-surface-sunken"
      }`}
    >
      <Sparkles className="h-4 w-4" aria-hidden="true" />
      {enabled ? "AI auto-reply: On" : "AI auto-reply: Off"}
    </button>
  );
}
