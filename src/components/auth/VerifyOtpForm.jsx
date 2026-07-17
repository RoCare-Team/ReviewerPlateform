"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import OtpInput from "./OtpInput";
import { FormError, SubmitButton } from "./Field";

const COOLDOWN_SECONDS = 60;

export default function VerifyOtpForm() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";

  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cooldown, setCooldown] = useState(COOLDOWN_SECONDS);

  // Mirrors the server's 60s resend cooldown. Cosmetic — the real limit is
  // enforced in lib/auth/otp.js; this just stops pointless requests.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    setPending(true);

    const res = await fetch("/api/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code, purpose: "signup" }),
    });

    setPending(false);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(data.error ?? "That code isn't valid.");
      if (data.code === "TOO_MANY_ATTEMPTS") setCode("");
      return;
    }

    router.push("/login?verified=1");
  }

  async function resend() {
    setError("");
    setCooldown(COOLDOWN_SECONDS);

    await fetch("/api/auth/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, purpose: "signup" }),
    });

    // Deliberately unconditional: the endpoint answers identically whether or
    // not the address exists, so the UI must not imply it learned anything.
    setNotice("If an account exists, we've sent a new code.");
  }

  if (!email) {
    return (
      <FormError>
        Missing email address. Start again from{" "}
        <a href="/signup" className="underline">
          sign up
        </a>
        .
      </FormError>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FormError>{error}</FormError>
      {notice ? (
        <div className="mb-4 rounded-btn border border-verified bg-verified-subtle px-3 py-2 text-sm text-primary">
          {notice}
        </div>
      ) : null}

      <OtpInput value={code} onChange={setCode} error={!!error} />

      <div className="mt-6">
        <SubmitButton pending={pending} disabled={code.length !== 6}>
          Verify email
        </SubmitButton>
      </div>

      <div className="mt-4 text-center text-sm text-secondary">
        {cooldown > 0 ? (
          <span className="text-muted">Resend code in {cooldown}s</span>
        ) : (
          <button type="button" onClick={resend} className="text-accent hover:underline">
            Resend code
          </button>
        )}
      </div>
    </form>
  );
}
