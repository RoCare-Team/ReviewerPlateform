"use client";

import { useState } from "react";
import { Label, Input, SubmitButton } from "./Field";

export default function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setPending(true);

    const form = new FormData(e.currentTarget);
    await fetch("/api/auth/password/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email") }),
    });

    setPending(false);
    // Always the same confirmation, whatever the server did. The endpoint is
    // opaque by design; showing "no such account" here would undo that.
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-btn border border-verified bg-verified-subtle px-4 py-3 text-sm text-primary">
        If an account exists for that address, we&apos;ve sent a reset link. It expires in
        1 hour.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="mt-6">
        <SubmitButton pending={pending}>Send reset link</SubmitButton>
      </div>
    </form>
  );
}
