"use client";

import { useState } from "react";
import { Gift, Copy, Check, Share2, Users, Smartphone, Clock, Globe } from "lucide-react";
import { toast } from "../../lib/toast";

/**
 * "Invite & earn" card — shown on both the reviewer profile and the business
 * settings page. Displays this account's own referral code (generated once at
 * signup, see lib/referral.js), the share link, and who has joined with it.
 *
 * ★ The share link points at the PLAY STORE, not the web signup form, because
 * the bonus is only paid once the referred person installs the app. Sharing
 * the web link would send people down the one path that earns nothing. The
 * website stays available underneath as a fallback for anyone who can't
 * install — clearly marked as not paying on its own.
 *
 * `history` is optional; without it the card degrades to just the code and
 * the share buttons.
 */
/**
 * The badge reports whether they got onto the APP — not whether the bonus was
 * paid. Those came apart the moment the install rule landed: accounts referred
 * before it were paid without ever installing, and saying "App installed" for
 * one of those would be a claim the data doesn't support.
 */
function SourceBadge({ row }) {
  if (row.installedApp) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-verified-subtle px-2 py-0.5 text-[11px] font-bold text-verified">
        <Smartphone className="h-3 w-3" aria-hidden="true" />
        App installed
      </span>
    );
  }
  if (row.bonusPaid) {
    // Paid under the old rules, before the reward required an install.
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-bold text-secondary">
        <Clock className="h-3 w-3" aria-hidden="true" />
        Paid earlier
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-bold text-muted">
      <Globe className="h-3 w-3" aria-hidden="true" />
      Web only — no app yet
    </span>
  );
}

function fmtDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function ReferralCard({
  code,
  rewardDisplay,
  referredCount,
  installedCount,
  paidCount,
  referralLink,
  webSignupLink,
  history = [],
}) {
  const [copied, setCopied] = useState(null); // "code" | "link" | null

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
    const text = `Install the RapportLook app with my referral code ${code} — ${referralLink}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join RapportLook", text, url: referralLink });
      } catch {
        // Cancelled — no toast, nothing went wrong.
      }
      return;
    }
    await copy(referralLink, "link");
  }

  if (!code) return null;

  const pending = Math.max(0, (referredCount ?? 0) - (installedCount ?? 0));

  return (
    <div className="rounded-card border border-default bg-surface-raised p-6 shadow-sm sm:p-8">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-subtle text-accent">
          <Gift className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-primary">Invite &amp; earn</h2>
          <p className="mt-0.5 text-sm text-secondary">
            Get <span className="font-semibold text-primary">{rewardDisplay}</span> for every person who{" "}
            <span className="font-semibold text-primary">installs the app</span> and signs up with your code.
            A website signup on its own doesn&apos;t earn the reward.
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

        {typeof paidCount === "number" && (
          <span className="inline-flex items-center gap-1.5 text-sm text-secondary">
            <Users className="h-4 w-4 text-muted" aria-hidden="true" />
            <span className="font-semibold text-primary">{paidCount} paid</span>
            {pending > 0 && <span className="text-muted">· {pending} yet to install</span>}
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
          Share app link
        </button>
        <button
          type="button"
          onClick={() => copy(referralLink, "link")}
          className="inline-flex items-center gap-1.5 rounded-btn border border-default bg-surface px-4 py-2 text-sm font-semibold text-secondary transition-all duration-200 hover:border-accent/40 hover:text-primary"
        >
          {copied === "link" ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          Copy link
        </button>
      </div>

      {webSignupLink && (
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Can&apos;t install the app? They can still join through{" "}
          <button
            type="button"
            onClick={() => copy(webSignupLink, "link")}
            className="font-medium text-secondary underline underline-offset-2 hover:text-primary"
          >
            your website link
          </button>{" "}
          — but the reward is only released once they install the app.
        </p>
      )}

      {history.length > 0 && (
        <div className="mt-6 border-t border-default pt-5">
          <h3 className="text-sm font-bold text-primary">Your referrals</h3>
          <ul className="mt-3 divide-y divide-default">
            {history.map((row, i) => (
              <li
                key={`${row.name}-${row.joinedAt}-${i}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-primary">
                  {row.name}
                  {row.phoneLast4 && <span className="text-muted"> ···{row.phoneLast4}</span>}
                </span>
                <SourceBadge row={row} />
                {row.bonusPaid && (
                  <span className="nums shrink-0 text-xs font-bold text-verified">+₹{row.reward}</span>
                )}
                <span className="w-full text-[11px] text-muted sm:w-auto sm:shrink-0">
                  Joined {fmtDate(row.joinedAt)}
                  {row.bonusPaid && row.bonusPaidAt ? ` · paid ${fmtDate(row.bonusPaidAt)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
