"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PasswordField from "./PasswordField";
import { FormError, SubmitButton } from "./Field";

export default function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setFieldError("");

    const form = new FormData(e.currentTarget);
    const password = form.get("password");
    const confirm = form.get("confirm");

    if (password !== confirm) {
      setFieldError("Passwords don't match.");
      return;
    }

    setPending(true);
    const res = await fetch("/api/auth/password/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setPending(false);

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }

    router.push("/login?reset=1");
  }

  if (!token) {
    return <FormError>This reset link is incomplete. Request a new one.</FormError>;
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FormError>{error}</FormError>

      <div className="space-y-4">
        <PasswordField
          id="password"
          name="password"
          label="New password"
          autoComplete="new-password"
          hint="At least 8 characters."
        />
        <PasswordField
          id="confirm"
          name="confirm"
          label="Confirm new password"
          autoComplete="new-password"
          error={fieldError}
        />
      </div>

      <div className="mt-6">
        <SubmitButton pending={pending}>Set new password</SubmitButton>
      </div>
    </form>
  );
}
