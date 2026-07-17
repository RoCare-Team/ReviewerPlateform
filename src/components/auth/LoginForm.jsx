"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Label, Input, FormError, SubmitButton } from "./Field";
import PasswordField from "./PasswordField";

/**
 * scope="user"  → /login       (reviewers + business owners; Google allowed)
 * scope="admin" → /admin/login (credentials + TOTP only; no Google button)
 *
 * scope is NOT a role claim — the server reads the role from the DB. It only
 * tells authorize() which door was used, so an admin can't log in through the
 * ordinary form (which has no TOTP field) and a normal user can't log in
 * through the admin one.
 */
export default function LoginForm({ scope = "user", requireTotp = false }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  // Path-only, and must start with a single "/" — "//evil.com" is a
  // protocol-relative URL the browser treats as absolute, so it's rejected too.
  const rawNext = params.get("next") ?? "";
  const next = /^\/(?!\/)/.test(rawNext) ? rawNext : null;

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setPending(true);

    const form = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      totp: form.get("totp") ?? "",
      scope,
      redirect: false,
    });

    setPending(false);

    if (res?.error) {
      // Auth.js surfaces thrown authorize() errors as a generic CredentialsSignin
      // in production, so we can't branch on the message reliably. One message
      // for every failure is also the correct posture: "wrong password" vs
      // "no such account" is an enumeration oracle.
      setError(
        requireTotp
          ? "Incorrect email, password, or authenticator code."
          : "Incorrect email or password."
      );
      return;
    }

    // Let the server decide the landing page from the session role — the client
    // must not pick a destination based on a role it believes it has.
    router.push(next ?? "/post-login");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FormError>{error}</FormError>

      <div className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>

        <PasswordField autoComplete="current-password" />

        {requireTotp ? (
          <div>
            <Label htmlFor="totp">Authenticator code</Label>
            <Input
              id="totp"
              name="totp"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              required
              className="font-mono tracking-widest"
            />
          </div>
        ) : null}
      </div>

      <div className="mt-6">
        <SubmitButton pending={pending}>Sign in</SubmitButton>
      </div>

      {scope === "user" ? (
        <p className="mt-4 text-center text-sm">
          <Link href="/forgot-password" className="text-accent hover:underline">
            Forgot your password?
          </Link>
        </p>
      ) : null}
    </form>
  );
}
