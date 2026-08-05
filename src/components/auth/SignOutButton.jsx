"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";
import { LogOut } from "lucide-react";

/**
 * Clears the session cookie and sends the user to a public page.
 *
 * `callbackUrl` must be a public route. Pointing it at anything under (app) or
 * /admin bounces the now-anonymous user straight back to a login screen, which
 * reads as "sign out didn't work".
 */
export default function SignOutButton({ callbackUrl = "/", iconOnly = false }) {
  const [pending, setPending] = useState(false);

  function go() {
    setPending(true);
    signOut({ callbackUrl });
  }

  const label = pending ? "Signing out…" : "Sign out";

  return (
    <button
      type="button"
      disabled={pending}
      onClick={go}
      title={iconOnly ? label : undefined}
      className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-secondary transition-colors duration-150 hover:bg-danger-subtle hover:text-danger disabled:opacity-60 ${
        iconOnly ? "justify-center" : "w-full"
      }`}
    >
      <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
      {iconOnly ? <span className="sr-only">{label}</span> : label}
    </button>
  );
}
