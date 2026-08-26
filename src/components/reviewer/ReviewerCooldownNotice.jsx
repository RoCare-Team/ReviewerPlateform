"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Timer } from "lucide-react";

/**
 * "Your next review unlocks in 3h 12m 04s" — the reviewer-facing half of the
 * platform-wide submission cooldown (AppSettings.reviewerCooldownHours, set by
 * admin, enforced in src/lib/pacing.js#checkReviewerCooldown).
 *
 * The server has already decided whether the reviewer is blocked and until
 * when; this only counts that instant down and refreshes the page the moment
 * it passes, so the campaign buttons re-enable on their own instead of the
 * reviewer having to guess and reload.
 *
 * Renders nothing when the reviewer isn't on cooldown, so both pages can drop
 * it in unconditionally.
 */
export function useCooldownCountdown(nextAvailableAt, onElapsed) {
  // Starts null and is only measured inside the effect (client-only), for the
  // same reason as the slot countdown in CampaignParticipation.jsx: computing
  // a Date.now()-derived value during render makes SSR and hydration disagree
  // on the second and React flags a mismatch.
  const [msLeft, setMsLeft] = useState(null);

  useEffect(() => {
    if (!nextAvailableAt) return;
    let fired = false;
    const tick = () => {
      const remaining = new Date(nextAvailableAt).getTime() - Date.now();
      setMsLeft(remaining);
      if (remaining <= 0 && !fired) {
        fired = true;
        onElapsed?.();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onElapsed is a fresh closure each render by design
  }, [nextAvailableAt]);

  if (!nextAvailableAt || msLeft === null || msLeft <= 0) return null;
  const total = Math.floor(msLeft / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}h ${pad(m)}m ${pad(s)}s` : `${m}m ${pad(s)}s`;
}

export default function ReviewerCooldownNotice({ cooldown }) {
  const router = useRouter();
  // Falls back to the server-rendered wording until the first client tick, so
  // the first paint already says something true rather than flashing empty.
  const live = useCooldownCountdown(cooldown?.nextAvailableAt, () => router.refresh());

  if (!cooldown?.blocked) return null;

  return (
    <div className="mt-6 flex items-start gap-3 rounded-card border border-pending bg-pending-subtle p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pending/15 text-pending">
        <Timer className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-primary">
          Next review unlocks in <span className="nums">{live ?? cooldown.waitLabel}</span>
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-secondary">
          Reviews have to be at least {cooldown.hours} hour{cooldown.hours === 1 ? "" : "s"} apart.
          Spacing them out keeps your account from looking automated — which is what gets reviews
          taken down. Browse the campaigns below and book your slot the moment the timer ends.
        </p>
      </div>
    </div>
  );
}
