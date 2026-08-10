"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { LogOut, Menu, Phone, X } from "lucide-react"; // Imported Menu and X icons for responsive layout
import Container from "./Container";
import RoleSignupModal from "../models/RoleSignupModal";
import { getContact } from "../../lib/contact";

// Global contact number — single source of truth is data/contact.json
// (phones.sales); null here just means it hasn't been filled in yet, so the
// link quietly doesn't render instead of showing a dead "tel:" placeholder.
const PHONE_DISPLAY = getContact("phones.sales.display");
const PHONE_E164 = getContact("phones.sales.e164");

/**
 * Public marketing header. NOT for signed-in surfaces — (app)/* and /admin have
 * their own headers with the session email and a sign-out button.
 *
 * Two states, driven by scroll:
 *  - At the top: a floating, rounded, inset "pill" navbar.
 *  - Once scrolled: it snaps to a full-width, flush bar like a normal navbar.
 *
 * `glass` is deliberate and load-bearing here: globals.css restricts it to the
 * hero and sticky headers, and this is the sticky header. Don't reach for it
 * elsewhere.
 */
const NAV = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#faq", label: "FAQ" },
  { href: "/about", label: "About" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
];

// Underline slides in from the center on hover/focus instead of a flat color
// swap — reads as a deliberate, springy motion rather than a state flicker.
function NavLink({ href, label }) {
  return (
    <Link
      href={href}
      className="group relative px-0.5 py-1 text-secondary transition-colors duration-200 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md"
    >
      {label}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 -bottom-0.5 h-0.5 origin-center scale-x-0 rounded-full bg-accent transition-transform duration-300 ease-out group-hover:scale-x-100 group-focus-visible:scale-x-100"
      />
    </Link>
  );
}

export default function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Signed in → one "Dashboard" link (/post-login sends them to the right
  // role's home server-side). Signed out → the usual Log in / Get started
  // pair. This is cosmetic only, same as RoleGate — the real gate is
  // requireRole()/requireAdmin() on the protected layouts themselves.
  const { data: session } = useSession();
  const isLoggedIn = Boolean(session?.user);
  const [signingOut, setSigningOut] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);

  function handleSignOut() {
    setSigningOut(true);
    // Back to the marketing homepage, not a protected route the now-anonymous
    // visitor would just get bounced from.
    signOut({ callbackUrl: "/" });
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Same escape-to-close + scroll-lock pattern as the app's modals
  // (ContactModal, RoleSignupModal) — this drawer is functionally a modal,
  // just anchored to the right edge instead of centered.
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileMenuOpen]);

  return (
    <header
      className={`sticky top-0 z-20 transition-all duration-300 ${
        scrolled ? "px-0 pt-0" : "px-4 pt-4 sm:pt-6"
      }`}
    >
      <div
        className={`glass mx-auto transition-all duration-300 overflow-hidden ${
          scrolled
            ? "max-w-none rounded-none border-x-0 border-t-0 shadow-sm"
            : "max-w-7xl rounded-full border shadow-lg"
        }`}
      >
        <Container className="grid grid-cols-[auto_1fr] items-center py-3 lg:grid-cols-[1fr_auto_1fr]">
          {/* Logo Brand Link */}
          <Link
            href="/"
            aria-label="RapportLook home"
            className="inline-flex w-fit items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {/* Intrinsic 1824×456; rendered at a fixed height with auto width.
                priority: it's above the fold on every page, so don't lazy-load it. */}
            <Image
              src="/img/logo4.png"
              alt="RapportLook"
              width={1824}
              height={456}
              priority
              className="h-11 w-auto sm:h-12"
            />
          </Link>

          {/* Desktop Navigation Links — true center column, independent of how
              wide the logo or the auth actions are on either side. Gap
              trimmed slightly (was gap-5) to free up room for the phone
              number below at `xl`, instead of hiding it until `2xl`. */}
          <nav aria-label="Main" className="hidden items-center gap-4 text-[15px] font-medium lg:flex">
            {NAV.map((n) => (
              <NavLink key={n.href} href={n.href} label={n.label} />
            ))}
          </nav>

          {/* Auth actions */}
          <div className="hidden items-center justify-end gap-4 text-[15px] font-medium lg:flex">
            {PHONE_E164 && (
              // Back from `xl` (was briefly hidden until `2xl` — the number
              // needs to stay visible here, not disappear). `whitespace-nowrap`
              // plus the trimmed gaps above are what actually fix the wrap,
              // not hiding it at a higher breakpoint.
              <a
                href={`tel:${PHONE_E164}`}
                className="hidden items-center gap-1.5 whitespace-nowrap text-secondary transition-colors duration-200 hover:text-accent xl:inline-flex"
              >
                <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
                {PHONE_DISPLAY}
              </a>
            )}
            {isLoggedIn ? (
              <>
                <Link
                  href="/post-login"
                  className="rounded-xl bg-accent px-5 py-2.5 font-semibold text-[15px] text-on-brand shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.98]"
                >
                  Dashboard
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-default px-4 py-2.5 font-semibold text-[15px] text-secondary transition-all duration-200 hover:-translate-y-0.5 hover:border-danger/40 hover:bg-danger-subtle hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.98] disabled:opacity-60"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  {signingOut ? "Signing out…" : "Logout"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setRoleModalOpen(true)}
                className="rounded-xl bg-accent px-5 py-2.5 font-semibold text-[15px] text-on-brand shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.98]"
              >
                Get started
              </button>
            )}
          </div>

          {/* Mobile Hamburguer Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="inline-flex items-center justify-center justify-self-end p-2 rounded-lg text-secondary hover:text-primary hover:bg-default/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:hidden transition-colors"
            aria-expanded={mobileMenuOpen}
            aria-label="Open navigation menu"
          >
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
        </Container>
      </div>

      {/* Mobile nav — a real side drawer (fixed, full height, slides in from
          the right) instead of a dropdown squeezed inside the rounded pill
          above. The pill's rounded-full shape has no sane way to host a tall
          expanding panel; stretching it to fit was clipping the logo. */}
      <div
        className={`fixed inset-0 z-50 lg:hidden ${mobileMenuOpen ? "" : "pointer-events-none"}`}
        aria-hidden={!mobileMenuOpen}
      >
        {/* Backdrop */}
        <div
          onClick={() => setMobileMenuOpen(false)}
          className={`absolute inset-0 bg-surface-inverse/60 backdrop-blur-sm transition-opacity duration-300 ${
            mobileMenuOpen ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden="true"
        />

        {/* Panel */}
        <nav
          aria-label="Mobile"
          className={`absolute inset-y-0 right-0 flex h-full w-full max-w-xs flex-col overflow-y-auto bg-surface-raised shadow-2xl transition-transform duration-300 ease-out ${
            mobileMenuOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between border-b border-default px-5 py-4">
            <Image src="/img/logo4.png" alt="RapportLook" width={1824} height={456} className="h-8 w-auto" />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation menu"
              className="rounded-full p-1.5 text-muted transition-all duration-200 hover:scale-110 hover:bg-surface-sunken hover:text-primary"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="flex flex-1 flex-col gap-1 px-3 py-4">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-btn px-3 py-2.5 text-base font-semibold text-secondary transition-colors hover:bg-surface-sunken hover:text-accent"
              >
                {n.label}
              </Link>
            ))}
          </div>

          <div className="mt-auto flex flex-col gap-2.5 border-t border-default p-4">
            {PHONE_E164 && (
              <a
                href={`tel:${PHONE_E164}`}
                className="inline-flex items-center justify-center gap-1.5 rounded-btn px-4 py-2 text-center text-sm font-semibold text-secondary transition-colors duration-200 hover:text-accent"
              >
                <Phone className="h-4 w-4" aria-hidden="true" />
                {PHONE_DISPLAY}
              </a>
            )}
            {isLoggedIn ? (
              <>
                <Link
                  href="/post-login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-btn bg-accent px-4 py-2.5 text-center font-bold text-sm text-on-brand shadow-md transition-all duration-200 hover:bg-accent-hover active:scale-[0.98]"
                >
                  Dashboard
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="inline-flex items-center justify-center gap-1.5 rounded-btn border border-default px-4 py-2.5 text-center font-bold text-sm text-secondary transition-all duration-200 hover:border-danger/40 hover:bg-danger-subtle hover:text-danger active:scale-[0.98] disabled:opacity-60"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  {signingOut ? "Signing out…" : "Logout"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setRoleModalOpen(true);
                }}
                className="rounded-btn bg-accent px-4 py-2.5 text-center font-bold text-sm text-on-brand shadow-md transition-all duration-200 hover:bg-accent-hover active:scale-[0.98]"
              >
                Get started
              </button>
            )}
          </div>
        </nav>
      </div>

      <RoleSignupModal isOpen={roleModalOpen} onClose={() => setRoleModalOpen(false)} />
    </header>
  );
}
