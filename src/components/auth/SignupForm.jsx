"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Label, Input, FieldError, FormError, SubmitButton } from "./Field";
import PasswordField from "./PasswordField";

/**
 * `role` picks the ENDPOINT, not a payload field:
 *   reviewer       → POST /api/auth/signup/reviewer
 *   business_owner → POST /api/auth/signup/business
 *
 * The body carries name/email/password only. The server derives role from the
 * route it received and re-checks it against roles.json, so editing this file in
 * devtools to say "admin" just posts to a URL that doesn't exist.
 */
const ENDPOINT = {
  reviewer: "/api/auth/signup/reviewer",
  business_owner: "/api/auth/signup/business",
};

export default function SignupForm({ role }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const endpoint = ENDPOINT[role];

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setPending(true);

    const form = new FormData(e.currentTarget);
    const email = form.get("email");

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email,
        password: form.get("password"),
      }),
    });

    setPending(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.details) setFieldErrors(data.details);
      else setError(data.error ?? "Something went wrong. Please try again.");
      return;
    }

    // Always lands here, existing account or not — the endpoint answers
    // identically either way so it can't be used to test which emails exist.
    router.push(`/verify-otp?email=${encodeURIComponent(email)}`);
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FormError>{error}</FormError>

      <div className="space-y-4">
        <div>
          <Label htmlFor="name">
            {role === "business_owner" ? "Your name" : "Full name"}
          </Label>
          <Input id="name" name="name" autoComplete="name" required error={fieldErrors.name?.[0]} />
          <FieldError id="name-error">{fieldErrors.name?.[0]}</FieldError>
        </div>

        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            error={fieldErrors.email?.[0]}
          />
          <FieldError id="email-error">{fieldErrors.email?.[0]}</FieldError>
        </div>

        <PasswordField
          autoComplete="new-password"
          label="Password"
          hint="At least 8 characters."
          error={fieldErrors.password?.[0]}
        />
      </div>

      <div className="mt-6">
        <SubmitButton pending={pending}>Create account</SubmitButton>
      </div>
    </form>
  );
}
