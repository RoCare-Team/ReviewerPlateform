"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Coins, Pencil, RotateCcw } from "lucide-react";
import { toast } from "../../lib/toast";

function inr(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

/**
 * Inline editor for a campaign's reviewer-reward override
 * (Campaign.reviewerReward — admin-only, see api/admin/campaigns/[id]/reward
 * and lib/verification.js). Shows the effective rate a reviewer earns on
 * THIS campaign: the override if one's set, otherwise the platform-wide
 * default, clearly labeled either way so it's never ambiguous which one
 * applies.
 */
export default function CampaignRewardControl({ campaignId, override, globalReward }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(override != null ? String(override) : "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function save(nextValue) {
    setPending(true);
    setError("");
    const res = await fetch(`/api/admin/campaigns/${campaignId}/reward`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewerReward: nextValue }),
    });
    setPending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message = data.error ?? "Couldn't update the reward.";
      setError(message);
      toast.error(message);
      return;
    }
    toast.success(nextValue === null ? "Reward reset to the global rate." : "Campaign reward updated.");
    setEditing(false);
    router.refresh();
  }

  function submit() {
    const n = Number(value);
    if (!value.trim() || Number.isNaN(n) || n <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    save(Math.floor(n));
  }

  if (editing) {
    return (
      <div className="mt-1 flex items-center gap-1.5">
        <div className="relative">
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted">₹</span>
          <input
            type="number"
            min={1}
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(""); }}
            autoFocus
            className={`nums w-20 rounded-btn border bg-surface-raised py-1 pl-5 pr-2 text-xs outline-none transition-all duration-200 focus:ring-2 focus:ring-accent/50 ${
              error ? "border-danger" : "border-default focus:border-accent"
            }`}
          />
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-btn bg-accent px-2 py-1 text-xs font-semibold text-on-brand shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60"
        >
          {pending ? "…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => { setEditing(false); setValue(override != null ? String(override) : ""); setError(""); }}
          disabled={pending}
          className="rounded-btn border border-default bg-surface px-2 py-1 text-xs font-semibold text-secondary transition-colors duration-200 hover:bg-surface-sunken"
        >
          Cancel
        </button>
        {error && <p className="ml-1 text-xs text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-0.5 flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setEditing(true)}
        title={override != null ? "Override for this campaign only" : "Using the global rate — click to override"}
        className="group inline-flex items-center gap-1 text-xs font-semibold text-secondary transition-colors duration-150 hover:text-accent"
      >
        <Coins className="h-3 w-3 text-muted group-hover:text-accent" aria-hidden="true" />
        {inr(override ?? globalReward)}
        <Pencil className="h-2.5 w-2.5 text-muted transition-colors duration-150 group-hover:text-accent" aria-hidden="true" />
      </button>
      {override != null ? (
        <button
          type="button"
          onClick={() => save(null)}
          disabled={pending}
          title="Reset to the global rate"
          className="inline-flex items-center gap-1 rounded-full bg-accent-subtle px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent transition-colors duration-150 hover:bg-danger-subtle hover:text-danger disabled:opacity-60"
        >
          <RotateCcw className="h-2.5 w-2.5" aria-hidden="true" />
          Custom
        </button>
      ) : (
        <span className="text-[10px] uppercase tracking-wide text-muted">Global</span>
      )}
    </div>
  );
}
