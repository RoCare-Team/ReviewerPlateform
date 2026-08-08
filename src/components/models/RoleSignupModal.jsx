"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, Check, MessageSquareQuote, X } from "lucide-react";

// Role picker, in a modal instead of a full page navigation. Each choice
// routes to a distinct signup page, which posts to a distinct endpoint — the
// role is carried by the URL, never by a form field. Mirrors the copy/options
// on /signup so the two stay in sync; this is the fast path from the header
// and hero CTAs, /signup is still there directly for anyone who lands on it.
const OPTIONS = [
  {
    href: "/signup/business",
    Icon: Building2,
    title: "Business",
    description: "Collect verified customer reviews and grow your online reputation.",
    points: ["Run review campaigns", "Track ratings across platforms", "Reply to feedback faster"],
  },
  {
    href: "/signup/reviewer",
    Icon: MessageSquareQuote,
    title: "Reviewer",
    description: "Leave honest reviews for real businesses and get rewarded for it.",
    points: ["Join open campaigns", "Get paid for verified participation", "Never for a positive rating"],
  },
];

export default function RoleSignupModal({ isOpen, onClose }) {
  const router = useRouter();

  // Same escape-to-close + scroll-lock pattern as the app's other modals
  // (ContactModal, NewCampaignModal).
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function choose(href) {
    onClose();
    router.push(href);
  }

  // Portal to <body> so the modal always escapes ancestor stacking contexts
  // (e.g. a section with `isolate`) instead of being trapped behind them.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose account type"
      className="animate-fade-up fixed inset-0 z-50 flex items-center justify-center bg-surface-inverse/60 p-4 backdrop-blur-sm"
      style={{ animationDuration: "200ms" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-default bg-surface-raised p-6 shadow-xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          type="button"
          className="absolute right-4 top-4 rounded-full p-1.5 text-muted transition-all duration-200 hover:scale-110 hover:bg-surface-sunken hover:text-primary"
          aria-label="Close"
        >
          <X className="h-4.5 w-4.5" aria-hidden="true" />
        </button>

        <div className="text-center sm:text-left">
          <h3 className="text-xl font-bold tracking-tight text-primary sm:text-2xl">
            How do you want to use RapportLook?
          </h3>
          <p className="mt-1.5 text-sm text-secondary">Pick one — it can&apos;t be switched later.</p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {OPTIONS.map((o) => (
            <button
              key={o.href}
              type="button"
              onClick={() => choose(o.href)}
              className="group flex h-full flex-col items-start rounded-card border border-default bg-surface p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:border-accent hover:bg-accent-subtle hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-accent-border bg-accent-subtle text-accent transition-all duration-300 group-hover:scale-110 group-hover:border-transparent group-hover:bg-accent group-hover:text-on-brand">
                <o.Icon className="h-5.5 w-5.5" aria-hidden="true" />
              </span>

              <span className="mt-4 flex w-full items-center justify-between gap-2">
                <span className="text-lg font-bold text-primary">{o.title}</span>
                <ArrowRight
                  className="h-4 w-4 shrink-0 text-accent opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-100"
                  aria-hidden="true"
                />
              </span>
              <span className="mt-1.5 block text-sm leading-relaxed text-secondary">{o.description}</span>

              <ul className="mt-4 w-full space-y-1.5 border-t border-default/70 pt-4">
                {o.points.map((point) => (
                  <li key={point} className="flex items-start gap-2 text-xs font-medium text-secondary">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-verified" aria-hidden="true" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
