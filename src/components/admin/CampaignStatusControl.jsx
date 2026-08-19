"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play } from "lucide-react";
import { toast } from "../../lib/toast";

const STATUS_STYLE = { active: "pill-verified", completed: "pill-accent", paused: "pill-pending", draft: "pill-pending" };

/**
 * Admin's own active/paused toggle for ANY campaign — independent of the
 * business owner's identical-looking control on their own dashboard (that
 * one's scoped to their own campaigns; this hits api/admin/campaigns/[id]/status,
 * which isn't). Only active <-> paused is a toggle here; completed/draft show
 * as a plain pill since there's no admin action for those.
 */
export default function CampaignStatusControl({ campaignId, status }) {
  const router = useRouter();
  const [current, setCurrent] = useState(status);
  const [pending, setPending] = useState(false);

  async function toggle() {
    const action = current === "active" ? "pause" : "activate";
    setPending(true);
    const res = await fetch(`/api/admin/campaigns/${campaignId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      toast.error(data.error ?? "Couldn't update the campaign.");
      return;
    }
    setCurrent(data.status);
    toast.success(data.status === "active" ? "Campaign activated." : "Campaign deactivated.");
    router.refresh();
  }

  if (current !== "active" && current !== "paused") {
    // completed / draft — nothing for admin to toggle, just show the state.
    return (
      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLE[current]}`}>
        {current}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLE[current]}`}>
        {current}
      </span>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        title={current === "active" ? "Deactivate this campaign" : "Reactivate this campaign"}
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide transition-colors duration-150 disabled:opacity-60 ${
          current === "active"
            ? "border-danger/40 text-danger hover:bg-danger-subtle"
            : "border-verified/40 text-verified hover:bg-verified-subtle"
        }`}
      >
        {current === "active" ? <Pause className="h-2.5 w-2.5" aria-hidden="true" /> : <Play className="h-2.5 w-2.5" aria-hidden="true" />}
        {pending ? "…" : current === "active" ? "Deactivate" : "Activate"}
      </button>
    </div>
  );
}
