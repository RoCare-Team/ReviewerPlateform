"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { User as UserIcon, ShieldCheck, ArrowLeft, RotateCcw } from "lucide-react";
import { Label, Input, FormError, SubmitButton } from "./Field";
import { toast } from "../../lib/toast";

const RESEND_SECONDS = 30;

/**
 * Phone+OTP form — the ONLY login/signup surface for reviewer and
 * business_owner (see data/roles.json: auth: ["phone-otp"]). Admin is
 * untouched (still LoginForm + email/password/TOTP at /admin/login).
 *
 * mode="login"  → role-agnostic, hits /api/auth/otp/phone/{send,verify}.
 *                 Only works for a phone that's already registered.
 * mode="signup" → `role` is required, hits
 *                 /api/auth/signup/{business,reviewer}/phone. Collects name
 *                 up front (no separate "complete your profile" step) and
 *                 creates the account on OTP success.
 *
 * Either way, once the server confirms the code it returns a one-shot
 * `otpToken` (lib/auth/phoneAuth.js) redeemed here via
 * signIn("phone-otp", ...) to establish the real NextAuth session — the
 * external SMS gateway never touches session state directly.
 */
export default function PhoneOtpForm({ mode = "login", role }) {
  const router = useRouter();
  const params = useSearchParams();

  const rawNext = params.get("next") ?? "";
  const next = /^\/(?!\/)/.test(rawNext) ? rawNext : null;

  const [step, setStep] = useState("phone"); // "phone" | "otp"
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", ""]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(0);

  const otpRefs = useRef([]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const sendEndpoint = "/api/auth/otp/phone/send";
  const verifyEndpoint =
    mode === "signup"
      ? role === "business_owner"
        ? "/api/auth/signup/business/phone"
        : "/api/auth/signup/reviewer/phone"
      : "/api/auth/otp/phone/verify";

  async function sendOtp(e) {
    e?.preventDefault();
    setError("");

    if (!/^\d{10}$/.test(phone)) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    if (mode === "signup" && !name.trim()) {
      setError("Enter your name.");
      return;
    }

    setPending(true);
    const res = await fetch(sendEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);

    if (!res.ok) {
      const message = data.error ?? "Failed to send OTP. Please try again.";
      setError(message);
      toast.error(message);
      return;
    }

    toast.success("OTP sent to your phone.");
    setOtpDigits(["", "", "", ""]);
    setStep("otp");
    setResendIn(RESEND_SECONDS);
    setTimeout(() => otpRefs.current[0]?.focus(), 50);
  }

  function handleOtpChange(index, value) {
    if (!/^[0-9]?$/.test(value)) return;
    setOtpDigits((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    setError("");
    if (value && index < 3) otpRefs.current[index + 1]?.focus();
  }

  function handleOtpKeyDown(index, e) {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  async function verifyOtp(e) {
    e.preventDefault();
    setError("");

    const otp = otpDigits.join("");
    if (!/^\d{4}$/.test(otp)) {
      setError("Enter the 4-digit code.");
      return;
    }

    setPending(true);
    const body = mode === "signup" ? { phone, otp, name: name.trim() } : { phone, otp };
    const res = await fetch(verifyEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setPending(false);
      if (data.code === "CROSS_ROLE") {
        const label = data.role === "business_owner" ? "business" : "reviewer";
        toast(`This number already has a ${label} account. Redirecting to login…`, { icon: "ℹ️" });
        setTimeout(() => router.push("/login"), 2000);
        return;
      }
      const message = data.error ?? "That code isn't valid.";
      setError(message);
      toast.error(message);
      return;
    }

    // Redeem the one-shot token to actually establish the session.
    const signInRes = await signIn("phone-otp", { phone, otpToken: data.otpToken, redirect: false });
    setPending(false);

    if (signInRes?.error) {
      setError("Something went wrong signing you in. Please try again.");
      toast.error("Something went wrong signing you in. Please try again.");
      return;
    }

    toast.success("Signed in.");
    router.push(next ?? "/post-login");
    router.refresh();
  }

  if (step === "phone") {
    return (
      <form onSubmit={sendOtp} noValidate>
        <FormError>{error}</FormError>

        <div className="space-y-4">
          {mode === "signup" && (
            <div>
              <Label htmlFor="name">{role === "business_owner" ? "Your name" : "Full name"}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={role === "business_owner" ? "Priya Sharma" : "Aditya Verma"}
                icon={UserIcon}
                required
              />
            </div>
          )}

          <div>
            <Label htmlFor="phone">Mobile number</Label>
            <div className="group relative flex items-center rounded-btn border border-default bg-surface transition-all duration-200 hover:border-strong focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/50">
              {/* Fixed +91 — not part of the value, so the input only ever
                  holds the 10 digits the backend/gateway expects. */}
              <span className="pointer-events-none select-none border-r border-default py-2.5 pl-3 pr-2.5 text-sm font-semibold text-secondary">
                +91
              </span>
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="98765 43210"
                maxLength={10}
                required
                autoFocus
                className="w-full rounded-r-btn bg-transparent py-2.5 pl-2.5 pr-3 text-primary outline-none placeholder:text-muted/70"
              />
            </div>
          </div>
        </div>

        <div className="mt-6">
          <SubmitButton pending={pending}>Send OTP</SubmitButton>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={verifyOtp} noValidate>
      <button
        type="button"
        onClick={() => {
          setStep("phone");
          setError("");
        }}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-secondary transition hover:text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Change number
      </button>

      <FormError>{error}</FormError>

      <div className="text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-accent-subtle text-accent">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="mt-3 text-sm text-secondary">
          Enter the 4-digit code sent to <span className="font-semibold text-primary">+91 {phone}</span>
        </p>
      </div>

      <div className="mt-5 flex justify-center gap-3">
        {otpDigits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => (otpRefs.current[i] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleOtpChange(i, e.target.value)}
            onKeyDown={(e) => handleOtpKeyDown(i, e)}
            className="h-12 w-12 rounded-btn border border-default bg-surface text-center text-lg font-bold text-primary outline-none transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/50"
          />
        ))}
      </div>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={sendOtp}
          disabled={resendIn > 0 || pending}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent transition hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
        </button>
      </div>

      <div className="mt-6">
        <SubmitButton pending={pending}>Verify & continue</SubmitButton>
      </div>
    </form>
  );
}
