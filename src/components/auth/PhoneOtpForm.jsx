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
 * ★ Name is asked for AFTER OTP verification, never before — and only when
 * the phone genuinely has no account yet:
 *
 *   phone → OTP → verify
 *     ├─ existing account (right role)  → straight to dashboard, no name asked
 *     ├─ existing account, OTHER role   → cross-role notice → /login
 *     └─ brand-new phone (signup only)  → one more step: name → account created
 *
 * mode="login"  → role-agnostic, only works for an already-registered phone.
 * mode="signup" → `role` required, can create a new account.
 *
 * See src/lib/auth/phoneAuth.js for the three-step server side of this
 * (requestPhoneOtp / verifyPhoneOtp / completePhoneSignup).
 */
export default function PhoneOtpForm({ mode = "login", role }) {
  const router = useRouter();
  const params = useSearchParams();

  const rawNext = params.get("next") ?? "";
  const next = /^\/(?!\/)/.test(rawNext) ? rawNext : null;

  const [step, setStep] = useState("phone"); // "phone" | "otp" | "name"
  const [phone, setPhone] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", ""]);
  const [name, setName] = useState("");
  const [verifiedToken, setVerifiedToken] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(0);

  const otpRefs = useRef([]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const completeEndpoint = role === "business_owner" ? "/api/auth/signup/business/complete" : "/api/auth/signup/reviewer/complete";

  async function finishSignIn(otpToken) {
    const signInRes = await signIn("phone-otp", { phone, otpToken, redirect: false });
    if (signInRes?.error) {
      setError("Something went wrong signing you in. Please try again.");
      toast.error("Something went wrong signing you in. Please try again.");
      return;
    }
    toast.success("Signed in.");
    router.push(next ?? "/post-login");
    router.refresh();
  }

  async function sendOtp(e) {
    e?.preventDefault();
    setError("");

    if (!/^\d{10}$/.test(phone)) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }

    setPending(true);
    const res = await fetch("/api/auth/otp/phone/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, intent: mode, ...(mode === "signup" ? { role } : {}) }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);

    if (!res.ok) {
      // Cross-role is caught here, BEFORE an OTP is even sent — a number
      // already registered under the other role never gets this far.
      if (data.code === "CROSS_ROLE") {
        const label = data.role === "business_owner" ? "business" : "reviewer";
        toast(`This number already has a ${label} account. Redirecting to login…`, { icon: "ℹ️" });
        setTimeout(() => router.push("/login"), 2000);
        return;
      }
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
    const res = await fetch("/api/auth/otp/phone/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, otp, intent: mode, ...(mode === "signup" ? { role } : {}) }),
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

    if (data.status === "existing") {
      // Account already exists — straight in, no name step.
      await finishSignIn(data.otpToken);
      setPending(false);
      return;
    }

    // Brand-new phone (signup only) — OTP already confirmed, now ask for a
    // name before the account is actually created.
    setPending(false);
    setVerifiedToken(data.verifiedToken);
    setStep("name");
  }

  async function completeSignup(e) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Enter your name.");
      return;
    }

    setPending(true);
    const res = await fetch(completeEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, name: name.trim(), verifiedToken }),
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
      const message = data.error ?? "Something went wrong. Please try again.";
      setError(message);
      toast.error(message);
      return;
    }

    await finishSignIn(data.otpToken);
    setPending(false);
  }

  if (step === "name") {
    return (
      <form onSubmit={completeSignup} noValidate>
        <FormError>{error}</FormError>

        <div className="mb-4 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-verified-subtle text-verified">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="mt-3 text-sm text-secondary">Number verified. One last thing —</p>
        </div>

        <div>
          <Label htmlFor="name">{role === "business_owner" ? "Your name" : "Full name"}</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={role === "business_owner" ? "Priya Sharma" : "Aditya Verma"}
            icon={UserIcon}
            required
            autoFocus
          />
        </div>

        <div className="mt-6">
          <SubmitButton pending={pending}>Create account</SubmitButton>
        </div>
      </form>
    );
  }

  if (step === "phone") {
    return (
      <form onSubmit={sendOtp} noValidate>
        <FormError>{error}</FormError>

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
