"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { setSignupIntent } from "../../lib/auth/actions";

/**
 * Google button for the signup pages.
 *
 * Records the role intent server-side (httpOnly cookie) BEFORE bouncing to
 * Google, because the OAuth callback arrives on a fresh request with no memory
 * of which signup page started it. The callback still re-validates the intent
 * against roles.json — this only carries it across the round-trip.
 */
export default function GoogleSignupButton({ role, label = "Continue with Google" }) {
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    const res = await setSignupIntent(role);
    if (!res?.ok) {
      setPending(false);
      return;
    }
    await signIn("google", { callbackUrl: "/post-login" });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="flex w-full items-center justify-center gap-3 rounded-btn border border-strong bg-surface px-4 py-2.5 font-medium text-primary transition hover:bg-surface-sunken disabled:opacity-60"
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
      {pending ? "Redirecting…" : label}
    </button>
  );
}
