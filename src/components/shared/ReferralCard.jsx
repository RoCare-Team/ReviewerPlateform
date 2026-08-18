"use client";

import { useState } from "react";
import { Gift, Copy, Check, Share2, Users } from "lucide-react";
import { toast } from "../../lib/toast";

/**
 * "Invite & earn" card — shown on both the reviewer profile and business
 * settings page (same component, different `signupPath`/copy). Displays this
 * user's own referral code (generated once at signup, see lib/referral.js)
 * and a ready-to-share link that pre-fills it on the signup form.
 */
export default function ReferralCard({ code, signupPath, rewardDisplay, referredCount, appUrl }) {
  const [copied, setCopied] = useState(null); // "code" | "link" | null

  const link = `${appUrl}${signupPath}?ref=${code}`;

  async function copy(text, which) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      toast.success(which === "code" ? "Code copied." : "Link copied.");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Couldn't copy — select and copy manually.");
    }
  }

  async function share() {
    const text = `Join RapportLook with my referral code ${code} — ${link}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join RapportLook", text, url: link });
      } catch {
        // Cancelled — no toast, nothing went wrong.
      }
      return;
    }
    await copy(link, "link");
  }

  if (!code) return null;

  return (
    <div className="rounded-card border border-default bg-surface-raised p-6 shadow-sm sm:p-8">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-subtle text-accent">
          <Gift className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-primary">Invite & earn</h2>
          <p className="mt-0.5 text-sm text-secondary">
            Share your code — you get <span className="font-semibold text-primary">{rewardDisplay}</span> for every
            person who joins with it.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-btn border border-dashed border-accent/50 bg-accent-subtle px-4 py-2.5">
          <span className="nums text-lg font-bold tracking-widest text-accent">{code}</span>
          <button
            type="button"
            onClick={() => copy(code, "code")}
            aria-label="Copy referral code"
            className="rounded-full p-1 text-accent transition-colors hover:bg-accent/10"
          >
            {copied === "code" ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>

        {typeof referredCount === "number" && (
          <span className="inline-flex items-center gap-1.5 text-sm text-secondary">
            <Users className="h-4 w-4 text-muted" aria-hidden="true" />
            {referredCount} joined so far
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={share}
          className="inline-flex items-center gap-1.5 rounded-btn bg-accent px-4 py-2 text-sm font-semibold text-on-brand shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-md"
        >
          <Share2 className="h-4 w-4" aria-hidden="true" />
          Share invite link
        </button>
        <button
          type="button"
          onClick={() => copy(link, "link")}
          className="inline-flex items-center gap-1.5 rounded-btn border border-default bg-surface px-4 py-2 text-sm font-semibold text-secondary transition-all duration-200 hover:border-accent/40 hover:text-primary"
        >
          {copied === "link" ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          Copy link
        </button>
      </div>
    </div>
  );
}
