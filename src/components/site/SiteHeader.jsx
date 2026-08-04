"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { LogOut, Menu, X } from "lucide-react"; // Imported Menu and X icons for responsive layout
import Container from "./Container";

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
            : "max-w-7xl rounded-2xl border shadow-lg"
        }`}
      >
        <Container className="grid grid-cols-[auto_1fr] items-center py-3 md:grid-cols-[1fr_auto_1fr]">
          {/* Logo Brand Link */}
          <Link
            href="/"
            aria-label="ReviewHub home"
            className="inline-flex w-fit items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {/* Intrinsic 1138×358; rendered at a fixed height with auto width.
                priority: it's above the fold on every page, so don't lazy-load it. */}
            <Image
              src="/img/logo.png"
              alt="ReviewHub"
              width={1138}
              height={358}
              priority
              className="h-11 w-auto sm:h-12"
            />
          </Link>

          {/* Desktop Navigation Links — true center column, independent of how
              wide the logo or the auth actions are on either side. */}
          <nav aria-label="Main" className="hidden items-center gap-8 text-[15px] font-medium md:flex">
            {NAV.map((n) => (
              <NavLink key={n.href} href={n.href} label={n.label} />
            ))}
          </nav>

          {/* Auth actions */}
          <div className="hidden items-center justify-end gap-6 text-[15px] font-medium md:flex">
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
              <>
                <NavLink href="/login" label="Log in" />
                <Link
                  href="/signup"
                  className="rounded-xl bg-accent px-5 py-2.5 font-semibold text-[15px] text-on-brand shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.98]"
                >
                  Get started
                </Link>
              </>
            )}
          </div>

          {/* Mobile Hamburguer Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="inline-flex items-center justify-center justify-self-end p-2 rounded-lg text-secondary hover:text-primary hover:bg-default/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:hidden transition-colors"
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" aria-hidden="true" />
            ) : (
              <Menu className="h-6 w-6" aria-hidden="true" />
            )}
          </button>
        </Container>

        {/* 
          Mobile Navigation Dropdown Panel:
          Expands gracefully directly within the glass frame container on smaller screens.
        */}
        {mobileMenuOpen && (
          <nav 
            aria-label="Mobile" 
            className="border-t border-default/40 px-6 py-5 flex flex-col gap-4 md:hidden bg-surface-raised/40 backdrop-blur-md animate-in slide-in-from-top-4 duration-200"
          >
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setMobileMenuOpen(false)}
                className="text-secondary font-semibold text-base transition-colors hover:text-accent"
              >
                {n.label}
              </Link>
            ))}
            
            <div className="my-1 border-t border-default/40" />

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
              <>
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-secondary font-semibold text-base transition-colors hover:text-accent"
                >
                  Log in
                </Link>

                <Link
                  href="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-btn bg-accent px-4 py-2.5 text-center font-bold text-sm text-on-brand shadow-md transition-all duration-200 hover:bg-accent-hover active:scale-[0.98]"
                >
                  Get started
                </Link>
              </>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}