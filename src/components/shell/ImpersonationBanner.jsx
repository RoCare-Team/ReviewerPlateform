"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, LogOut } from "lucide-react";
import { toast } from "../../lib/toast";

/**
 * Persistent strip shown across every page while an admin is "logged in as"
 * this account (see lib/auth/impersonation.js) — the whole point of it
 * existing is that it must never be missable, so it's fixed at the very top,
 * above the shell's own header, on every protected route for this role.
 *
 * Styled like the rest of the app's inline notices (accent-subtle pill, same
 * family as the "connected"/status banners elsewhere) rather than a loud
 * standalone warning color — it's an FYI + one action, not an alert.
 */
export default function ImpersonationBanner({ adminEmail }) {
  const router = useRouter();
  const [ending, setEnding] = useState(false);

  async function returnToAdmin() {
    setEnding(true);
    const res = await fetch("/api/admin/impersonate/stop", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setEnding(false);
    if (!res.ok) {
      toast.error(data.error ?? "Couldn't end impersonation.");
      return;
    }
    router.push(data.redirect ?? "/admin");
    router.refresh();
  }

  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 border-b border-accent-border bg-accent-subtle px-4 py-2 text-center text-xs font-medium text-accent sm:text-sm">
      <span className="inline-flex items-center gap-1.5">
        <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Viewing as this account{adminEmail ? ` · logged in by ${adminEmail}` : ""}
      </span>
      <button
        type="button"
        onClick={returnToAdmin}
        disabled={ending}
        className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-surface px-2.5 py-0.5 text-xs font-semibold text-accent transition-colors duration-150 hover:bg-accent hover:text-on-brand disabled:opacity-60"
      >
        <LogOut className="h-3 w-3" aria-hidden="true" />
        {ending ? "Returning…" : "Return to admin"}
      </button>
    </div>
  );
}
