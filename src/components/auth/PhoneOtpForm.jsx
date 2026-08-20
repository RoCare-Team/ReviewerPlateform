"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { User as UserIcon, ShieldCheck, ArrowLeft, RotateCcw, Gift, Building2, MessageSquareQuote } from "lucide-react";
import { Label, Input, FormError, SubmitButton } from "./Field";
import StateCitySelect from "../ui/StateCitySelect";
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
 * mode="login"  → role-agnostic. An already-registered phone signs straight
 *   in as before. A phone with NO account isn't a dead end anymore either —
 *   there's no real "signup" concept from the user's side, just "log in, and
 *   if you're new we'll ask what kind of account to make": one extra step
 *   (Business/Reviewer) is inserted before the name step in that case.
 * mode="signup" → `role` fixed by the calling page (/signup/business or
 *   /signup/reviewer), so that extra role step never shows here.
 *
 * See src/lib/auth/phoneAuth.js for the three-step server side of this
 * (requestPhoneOtp / verifyPhoneOtp / completePhoneSignup).
 */
export default function PhoneOtpForm({ mode = "login", role }) {
  const router = useRouter();
  const params = useSearchParams();

  const rawNext = params.get("next") ?? "";
  const next = /^\/(?!\/)/.test(rawNext) ? rawNext : null;

  // ?role=business_owner|reviewer — set by the "How do you want to use
  // RapportLook?" role picker (see RoleSignupModal.jsx) before landing here.
  // Purely a hint for a brand-new phone: it skips the inline "role" step
  // below and goes straight to name/city. An existing account ignores it
  // entirely and just logs in as whatever it already is.
  const roleParam = params.get("role");
  const roleHint = roleParam === "business_owner" || roleParam === "reviewer" ? roleParam : null;

  const [step, setStep] = useState("phone"); // "phone" | "otp" | "role" | "name"
  const [phone, setPhone] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", ""]);
  const [name, setName] = useState("");
  // Set from the "role" step below (a /login attempt with no fixed `role`
  // prop, no `roleHint`, that turned out to be a brand-new phone) OR
  // pre-filled from `roleHint`. Signup pages that pass `role` as a prop never
  // touch this — `effectiveRole` falls back to the prop first.
  const [pickedRole, setPickedRole] = useState(() => roleHint);
  const effectiveRole = role || pickedRole;
  // Reviewer signup only — a business account has no city field. Campaigns
  // are matched to reviewers by city (Campaign.city, reviewer/campaigns/page.jsx),
  // so this replaces the old post-login mandatory GPS capture (LocationGate)
  // with a one-time declaration right here, before the account even exists.
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  // Reviewer signup only — self-declared 18+ checkbox, enforced again
  // server-side (completePhoneSignup) so this client check is a UX nicety,
  // not the gate.
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  // Auto-filled from a shared link (?ref=CODE — see lib/referral.js), but
  // always left editable: someone can still type a code by hand, or a friend
  // can tell them theirs verbally instead of sending a link.
  const [referralCode, setReferralCode] = useState(() => (params.get("ref") ?? "").trim().toUpperCase());
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

  const completeEndpoint = effectiveRole === "business_owner" ? "/api/auth/signup/business/complete" : "/api/auth/signup/reviewer/complete";

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

    // Brand-new phone — OTP already confirmed, account not created yet.
    // Role already known (signup page's `role` prop, or a `?role=` hint from
    // the role picker) → straight to the name step. Otherwise nobody's said
    // what kind of account this should be yet — ask that first.
    setPending(false);
    setVerifiedToken(data.verifiedToken);
    setStep(effectiveRole ? "name" : "role");
  }

  function pickRole(r) {
    setPickedRole(r);
    setStep("name");
  }

  async function completeSignup(e) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Enter your name.");
      return;
    }
    if (effectiveRole === "reviewer" && !city.trim()) {
      setError("Select your city.");
      return;
    }
    if (effectiveRole === "reviewer" && !ageConfirmed) {
      setError("You are not eligible for review — you must be 18 or older.");
      return;
    }

    setPending(true);
    const res = await fetch(completeEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone,
        name: name.trim(),
        verifiedToken,
        ...(effectiveRole === "reviewer" ? { city: city.trim(), ageConfirmed } : {}),
        ...(referralCode.trim() ? { referralCode: referralCode.trim() } : {}),
      }),
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

  // Login-only: the phone turned out to have no account, so before asking
  // for a name we need to know which kind of account to create — inline
  // right here in the OTP flow, not a separate signup page. Picking one
  // moves straight to the name step.
  if (step === "role") {
    return (
      <div>
        <div className="mb-4 flex items-center justify-center gap-1.5" aria-hidden="true">
          <span className="h-1.5 w-4 rounded-full bg-accent" />
          <span className="h-1.5 w-4 rounded-full bg-accent" />
          <span className="h-1.5 w-4 rounded-full bg-default/40" />
        </div>

        <p className="text-center text-sm font-semibold text-primary">
          No account yet on this number — how do you want to use RapportLook?
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => pickRole("business_owner")}
            className="flex flex-col items-start rounded-card border border-default bg-surface p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:bg-accent-subtle hover:shadow-md"
          >
            <Building2 className="h-5 w-5 text-accent" aria-hidden="true" />
            <span className="mt-2 text-sm font-bold text-primary">Business</span>
            <span className="mt-0.5 text-xs text-secondary">Collect verified customer reviews.</span>
          </button>
          <button
            type="button"
            onClick={() => pickRole("reviewer")}
            className="flex flex-col items-start rounded-card border border-default bg-surface p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:bg-accent-subtle hover:shadow-md"
          >
            <MessageSquareQuote className="h-5 w-5 text-accent" aria-hidden="true" />
            <span className="mt-2 text-sm font-bold text-primary">Reviewer</span>
            <span className="mt-0.5 text-xs text-secondary">Leave reviews, get rewarded.</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => { setStep("phone"); setError(""); }}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-secondary transition hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Change number
        </button>
      </div>
    );
  }

  if (step === "name") {
    return (
      <form onSubmit={completeSignup} noValidate>
        <FormError>{error}</FormError>

        {/* Compact step indicator — replaces the old big icon+headline block,
            which ate a lot of vertical space just to say "you're basically
            done". Three steps: phone → OTP → this one; all filled since the
            first two are already behind us here. */}
        <div className="mb-4 flex items-center justify-center gap-1.5" aria-hidden="true">
          <span className="h-1.5 w-4 rounded-full bg-accent" />
          <span className="h-1.5 w-4 rounded-full bg-accent" />
          <span className="h-1.5 w-4 rounded-full bg-accent" />
        </div>

        <div>
          <Label htmlFor="name">{effectiveRole === "business_owner" ? "Your name" : "Full name"}</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={effectiveRole === "business_owner" ? "Priya Sharma" : "Aditya Verma"}
            icon={UserIcon}
            required
            autoFocus
          />
        </div>

        {effectiveRole === "reviewer" && (
          <>
            <div className="mt-4">
              <Label htmlFor="signup-state-state">Your city</Label>
              <StateCitySelect
                idPrefix="signup-state"
                state={state}
                city={city}
                onStateChange={(s) => { setState(s); setCity(""); }}
                onCityChange={setCity}
              />
              <p className="mt-1.5 text-xs text-muted">
                You&apos;ll only see campaigns from this city — no location access needed.
              </p>
            </div>

            <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-btn border border-default bg-surface px-3.5 py-3 transition-colors duration-200 hover:border-strong">
              <input
                type="checkbox"
                checked={ageConfirmed}
                onChange={(e) => setAgeConfirmed(e.target.checked)}
                required
                className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
              />
              <span className="text-sm text-primary">
                I confirm I am <span className="font-semibold">18 years or older</span>.
              </span>
            </label>
          </>
        )}

        <div className="mt-4">
          <Label htmlFor="referralCode">Referral code (optional)</Label>
          <Input
            id="referralCode"
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
            placeholder="e.g. AB12CD"
            icon={Gift}
            maxLength={20}
          />
          <p className="mt-1.5 text-xs text-muted">
            Got invited by someone? Enter their code — they&apos;ll get a referral bonus.
          </p>
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
