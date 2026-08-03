"use client";

import {
  Building2,
  Coins,
  CreditCard,
  LayoutDashboard,
  Link2,
  Megaphone,
  Menu,
  MessageSquare,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Star,
  User,
  Users,
  ChevronDown,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import SignOutButton from "../auth/SignOutButton";

/**
 * Sidebar shell shared by /reviewer, /business, and /admin.
 *
 * Client-side only because of the mobile drawer and the active-link check. It
 * receives already-resolved props — the layouts above it stay server components
 * so requireRole()/requireAdmin() still run on the server. Never move an auth
 * decision in here: this file ships to the browser.
 *
 * Nav items may set `soon: true` to render as disabled. Several admin sections
 * are designed but not built; a visible-but-disabled row shows the shape of the
 * panel without sending anyone to a 404.
 *
 * Icons are named by string, not passed as components: the layouts calling this
 * are server components, and a function prop can't cross that boundary. Add the
 * icon to this map, then reference its key from the layout's NAV.
 */
const ICONS = {
  dashboard: LayoutDashboard,
  feedback: MessageSquare,
  reviews: Star,
  campaigns: Megaphone,
  connections: Link2,
  settings: Settings,
  profile: User,
  users: Users,
  organisations: Building2,
  moderation: ShieldCheck,
  payments: CreditCard,
  trust: ShieldAlert,
};

function NavLink({ item, active, onNavigate }) {
  // Unknown key renders text-only rather than crashing the whole panel.
  const Icon = ICONS[item.icon];
  const icon = Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null;

  if (item.soon) {
    return (
      <span
        aria-disabled="true"
        className="flex cursor-default items-center gap-2.5 rounded-btn px-3 py-2 text-sm text-muted"
      >
        {icon}
        <span className="flex-1">{item.label}</span>
        <span className="rounded-full bg-surface-sunken px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
          Soon
        </span>
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "flex items-center gap-2.5 rounded-btn bg-accent-subtle px-3 py-2 text-sm font-medium text-accent"
          : "flex items-center gap-2.5 rounded-btn px-3 py-2 text-sm text-secondary transition hover:bg-surface-sunken hover:text-primary"
      }
    >
      {icon}
      {item.label}
    </Link>
  );
}

/**
 * Topbar balance chip. Same number, different framing per role: a business
 * FUNDS campaigns from a wallet, a reviewer EARNS coins from verified work.
 * Both read `walletBalance` — only the label and icon change.
 */
const WALLET_VARIANT = {
  wallet: { Icon: Wallet, title: "Wallet balance", srLabel: "Wallet balance" },
  coins: { Icon: Coins, title: "Coins earned — tap to see your rewards", srLabel: "Coins earned" },
};

export default function AppShell({
  brand,
  badge,
  nav,
  user,
  profileHref,
  walletBalance = null,
  walletHref,
  walletVariant = "wallet",
  signOutTo = "/",
  children,
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // A route change must close the drawer/menu, or the new page renders underneath.
  useEffect(() => {
    setOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  // Label for the current page — the active nav item's label.
  const currentLabel = nav.find((i) => i.href === pathname)?.label
    ?? nav.find((i) => pathname.startsWith(i.href + "/"))?.label
    ?? "";

  const initial = (user.name || user.email || "?").charAt(0).toUpperCase();

  const wallet = WALLET_VARIANT[walletVariant] ?? WALLET_VARIANT.wallet;

  // Only the MOST specific matching nav item is active. Without this, a section
  // root like "/business" (a prefix of every child route) would stay highlighted
  // on "/business/reviews" alongside the real active item.
  const activeHref = nav
    .filter((i) => !i.soon)
    .filter((i) => pathname === i.href || pathname.startsWith(i.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const isActive = (href) => href === activeHref;

  const sidebar = (
    <>
      <div className="flex items-center gap-2 px-3 py-4">
        <Link href={nav[0]?.href ?? "/"} className="font-semibold tracking-tight text-primary">
          {brand}
        </Link>
        {badge && (
          <span className="rounded bg-danger-subtle px-1.5 py-0.5 text-xs font-medium text-danger">
            {badge}
          </span>
        )}
      </div>

      <nav aria-label="Sidebar" className="flex flex-1 flex-col gap-1 px-2">
        {nav.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={!item.soon && isActive(item.href)}
            onNavigate={() => setOpen(false)}
          />
        ))}
      </nav>

      <div className="border-t border-default p-3">
        <p className="truncate px-1 pb-2 text-xs text-muted" title={user.email}>
          {user.email}
        </p>
        <SignOutButton callbackUrl={signOutTo} />
      </div>
    </>
  );

  return (
    <div className="min-h-dvh lg:flex lg:h-dvh lg:overflow-hidden">
      {/* Desktop rail — fixed full height; its own content scrolls if needed. */}
      <aside className="hidden w-60 shrink-0 overflow-y-auto border-r border-default bg-surface-raised lg:flex lg:h-dvh lg:flex-col">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-20 bg-surface-inverse/40"
          />
          <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-default bg-surface-raised">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:h-dvh lg:overflow-y-auto">
        {/* Top bar — shown on every size. Mobile also uses it to open the drawer. */}
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-default bg-surface-raised/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            className="rounded-btn border border-default p-1.5 text-secondary transition hover:bg-surface-sunken hover:text-primary lg:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>

          {/* Mobile: brand. Desktop: current page title. */}
          <span className="font-semibold tracking-tight text-primary lg:hidden">{brand}</span>
          <span className="hidden text-sm font-semibold text-primary lg:inline">{currentLabel}</span>
          {badge && (
            <span className="rounded bg-danger-subtle px-1.5 py-0.5 text-xs font-medium text-danger">
              {badge}
            </span>
          )}

          {/* Balance chip — left of the profile menu. Wallet for a business
              owner, coins earned for a reviewer. */}
          {walletBalance !== null && (
            <Link
              href={walletHref ?? "#"}
              className="group ml-auto inline-flex items-center gap-1.5 rounded-full border border-default bg-surface px-3 py-1.5 text-sm font-semibold text-primary transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:bg-accent-subtle hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              title={wallet.title}
            >
              <wallet.Icon
                className="h-4 w-4 text-accent transition-transform duration-300 group-hover:scale-110"
                aria-hidden="true"
              />
              {/* The number alone is meaningless to a screen reader here. */}
              <span className="sr-only">{wallet.srLabel}:</span>
              <span className="nums">₹{Number(walletBalance).toLocaleString("en-IN")}</span>
            </Link>
          )}

          {/* Profile menu */}
          <div className={`relative ${walletBalance !== null ? "" : "ml-auto"}`}>
            <button
              type="button"
              onClick={() => setProfileOpen((v) => !v)}
              aria-expanded={profileOpen}
              aria-haspopup="menu"
              className="flex items-center gap-2 rounded-full border border-default bg-surface py-1 pl-1 pr-2.5 text-sm transition hover:bg-surface-sunken"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-brand">
                {initial}
              </span>
              <span className="hidden max-w-[10rem] truncate font-semibold text-primary sm:inline">
                {user.name || user.email}
              </span>
              <ChevronDown className="h-4 w-4 text-muted" aria-hidden="true" />
            </button>

            {profileOpen && (
              <>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setProfileOpen(false)}
                  className="fixed inset-0 z-10 cursor-default"
                />
                <div
                  role="menu"
                  className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-card border border-default bg-surface-raised shadow-lg"
                >
                  <div className="border-b border-default px-4 py-3">
                    {user.name && <p className="truncate text-sm font-bold text-primary">{user.name}</p>}
                    <p className="truncate text-xs text-muted">{user.email}</p>
                  </div>
                  {profileHref && (
                    <Link
                      href={profileHref}
                      role="menuitem"
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-secondary transition hover:bg-surface-sunken hover:text-primary"
                    >
                      <User className="h-4 w-4" aria-hidden="true" />
                      Profile
                    </Link>
                  )}
                  <div className="border-t border-default p-2">
                    <SignOutButton callbackUrl={signOutTo} />
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
