"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  Building2,
  Gift,
  MessageSquareQuote,
  ShieldCheck,
  Star,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";

/**
 * Left branded panel for the auth split layout. Copy switches by route so each
 * flow (business signup, reviewer signup, sign in, password reset) gets relevant
 * messaging. All copy is participation-framed — see the compliance note in
 * src/app/page.jsx.
 */

const BUSINESS = {
  headline: "Grow your reputation with verified customer reviews",
  points: [
    { Icon: BadgeCheck, text: "Verified reviews across Google, Trustpilot, G2 & 100+ platforms" },
    { Icon: ShieldCheck, text: "Screenshot + AI verification on every submission" },
    { Icon: Gift, text: "Reviewers rewarded for verified participation, never positive ratings" },
  ],
  quote:
    "Finally a review platform that keeps us policy-compliant — verified participation, never paid-for ratings.",
  caption: "Trusted by 2,500+ businesses worldwide",
};

const REVIEWER = {
  headline: "Get rewarded for honest, verified participation",
  points: [
    { Icon: Trophy, text: "Join campaigns and submit reviews across major platforms" },
    { Icon: Wallet, text: "Earn reward points for verified work — withdraw your earnings" },
    { Icon: Users, text: "Rewards are for participation, never for leaving positive ratings" },
  ],
  quote:
    "Simple, transparent and fair — I get points for real, verified activity, not for faking praise.",
  caption: "Join thousands of verified reviewers",
};

// Role picker (/signup). Neutral on purpose — it speaks to both audiences,
// because the visitor hasn't told us which one they are yet.
const CHOOSE_ROLE = {
  headline: "One platform. Two ways in.",
  points: [
    { Icon: Building2, text: "Businesses collect and monitor verified reviews in one dashboard" },
    { Icon: MessageSquareQuote, text: "Reviewers join campaigns and earn points for verified work" },
    { Icon: ShieldCheck, text: "Every submission screenshot- and AI-verified before it counts" },
  ],
  quote:
    "Whichever side you're on, the rule is the same — rewards follow verified participation, never a positive rating.",
  caption: "2,500+ businesses · thousands of verified reviewers",
};

const SIGN_IN = {
  headline: "Welcome back to ReviewHub",
  points: [
    { Icon: BadgeCheck, text: "One dashboard for reviews across every platform that matters" },
    { Icon: ShieldCheck, text: "Every submission verified before it counts" },
    { Icon: Gift, text: "Built for compliance — participation, never paid-for ratings" },
  ],
  quote:
    "Everything in one place — campaigns, verification and analytics, all policy-compliant.",
  caption: "Trusted by 2,500+ businesses worldwide",
};

function contentFor(pathname) {
  if (pathname?.startsWith("/signup/reviewer")) return REVIEWER;
  // The role picker itself: no role chosen yet, so the panel must not lean
  // business or reviewer. Checked before the generic /signup prefix below.
  if (pathname === "/signup") return CHOOSE_ROLE;
  if (pathname?.startsWith("/signup")) return BUSINESS;
  // login, forgot-password, reset-password, verify-otp, auth-error
  return SIGN_IN;
}

export default function AuthAside() {
  const pathname = usePathname();
  const { headline, points, quote, caption } = contentFor(pathname);

  return (
    <aside className="relative hidden overflow-hidden bg-accent lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
      {/* Ambient depth */}
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-black/10 blur-3xl"
        aria-hidden="true"
      />

      <Link
        href="/"
        aria-label="ReviewHub home"
        className="relative inline-flex w-fit items-center rounded-lg bg-white/95 px-3 py-2 shadow-sm"
      >
        <Image src="/img/logo.png" alt="ReviewHub" width={1138} height={358} className="h-8 w-auto" />
      </Link>

      <div className="relative">
        <h2 className="max-w-md text-3xl font-extrabold leading-tight tracking-tight text-on-brand xl:text-4xl">
          {headline}
        </h2>
        <ul className="mt-8 space-y-4">
          {points.map(({ Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-on-brand/90">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15">
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span className="text-sm leading-relaxed">{text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
        <div className="flex gap-0.5" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="h-4 w-4 fill-amber-300 text-amber-300" />
          ))}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-on-brand/95">&ldquo;{quote}&rdquo;</p>
        <p className="mt-2 text-xs font-semibold text-on-brand/70">{caption}</p>
      </div>
    </aside>
  );
}
