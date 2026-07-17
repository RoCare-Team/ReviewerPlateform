"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";

/**
 * Clears the session cookie and sends the user to a public page.
 *
 * `callbackUrl` must be a public route. Pointing it at anything under (app) or
 * /admin bounces the now-anonymous user straight back to a login screen, which
 * reads as "sign out didn't work".
 */
export default function SignOutButton({ callbackUrl = "/" }) {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        setPending(true);
        signOut({ callbackUrl });
      }}
      className="rounded-btn border border-default px-2.5 py-1 text-sm text-secondary transition hover:bg-surface-sunken hover:text-primary disabled:opacity-60"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
