"use client";

import {
  Building2,
  Coins,
  CreditCard,
  Landmark,
  LayoutDashboard,
  Link2,
  Megaphone,
  Menu,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
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
  withdraw: Landmark,
};

function NavLink({ item, active, onNavigate, collapsed }) {
  // Unknown key renders text-only rather than crashing the whole panel.
  const Icon = ICONS[item.icon];

  if (item.soon) {
    return (
      <span
        aria-disabled="true"
        title={collapsed ? item.label : undefined}
        className={`flex cursor-default items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted ${
          collapsed ? "justify-center" : ""
        }`}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-sunken">
          {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
        </span>
        {!collapsed && (
          <>
            <span className="flex-1">{item.label}</span>
            <span className="rounded-full bg-surface-sunken px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
              Soon
            </span>
          </>
        )}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${
        collapsed ? "justify-center" : ""
      } ${
        active
          ? "bg-accent-subtle font-semibold text-accent"
          : "font-medium text-secondary hover:translate-x-0.5 hover:bg-surface-sunken hover:text-primary"
      }`}
    >
      {/* Active indicator — a soft bar that fades/slides in rather than snapping */}
      <span
        aria-hidden="true"
        className={`absolute -left-2 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-accent transition-all duration-200 ${
          active ? "opacity-100" : "opacity-0"
        }`}
      />
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200 ${
          active ? "bg-accent text-on-brand" : "bg-surface-sunken text-secondary group-hover:text-primary"
        }`}
      >
        {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
      </span>
      {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
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
  // Desktop-only rail collapse (icons-only). Never affects the mobile drawer,
  // which always opens full-width. Persisted so it survives a reload/nav.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem("sidebar-collapsed") === "1");
  }, []);

  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v;
      window.localStorage.setItem("sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  }

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

  // `forceExpanded` is used for the mobile drawer, which ignores the desktop
  // collapse preference and always shows full labels.
  function renderSidebar(forceExpanded) {
    const isCollapsed = collapsed && !forceExpanded;

    return (
      <>
        <div
          className={`flex items-center gap-2.5 border-b border-default px-4 py-4 ${
            isCollapsed ? "justify-center px-2" : ""
          }`}
        >
          {/* Brand mark always goes to the public homepage, not the dashboard
              root — a logo click is "take me to the site", same as every
              marketing header, not "take me to my overview page". Hidden
              when collapsed so the rail only shows the expand toggle. */}
          {!isCollapsed && (
            <>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-bold text-on-brand">
                {brand.charAt(0)}
              </span>
              <Link href="/" className="text-base font-bold tracking-tight text-primary">
                {brand}
              </Link>
            </>
          )}
          {!isCollapsed && badge && (
            <span className="rounded bg-danger-subtle px-1.5 py-0.5 text-xs font-semibold text-danger">
              {badge}
            </span>
          )}
          {/* Desktop-only collapse toggle, right of the logo — not shown in
              the mobile drawer, which has its own close affordance (the
              backdrop). */}
          {!forceExpanded && (
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-pressed={collapsed}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={`hidden shrink-0 items-center justify-center rounded-lg p-1.5 text-secondary transition-colors duration-150 hover:bg-surface-sunken hover:text-primary lg:flex ${
                isCollapsed ? "" : "ml-auto"
              }`}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
              ) : (
                <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
              )}
              <span className="sr-only">{collapsed ? "Expand sidebar" : "Collapse sidebar"}</span>
            </button>
          )}
        </div>

        <nav
          aria-label="Sidebar"
          className={`flex flex-1 flex-col gap-1.5 pt-4 ${isCollapsed ? "px-2" : "px-3"}`}
        >
          {nav.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={!item.soon && isActive(item.href)}
              onNavigate={() => setOpen(false)}
              collapsed={isCollapsed}
            />
          ))}
        </nav>

        <div className={`border-t border-default p-3 ${isCollapsed ? "px-2" : ""}`}>
          <div
            className={`flex items-center gap-2.5 rounded-xl px-2 py-2 ${
              isCollapsed ? "justify-center" : ""
            }`}
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-xs font-bold text-accent"
              title={isCollapsed ? (user.name || user.email) : undefined}
            >
              {initial}
            </span>
            {!isCollapsed && (
              <div className="min-w-0">
                {user.name && <p className="truncate text-sm font-semibold text-primary">{user.name}</p>}
                <p className="truncate text-xs text-muted" title={user.email}>{user.email}</p>
              </div>
            )}
          </div>
          <div className="mt-1">
            <SignOutButton callbackUrl={signOutTo} iconOnly={isCollapsed} />
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-dvh lg:flex lg:h-dvh lg:overflow-hidden">
      {/* Desktop rail — fixed full height; its own content scrolls if needed.
          Width animates between full (w-60) and icons-only (w-[4.5rem]). */}
      <aside
        className={`hidden shrink-0 overflow-y-auto border-r border-default bg-surface-raised transition-all duration-200 lg:flex lg:h-dvh lg:flex-col ${
          collapsed ? "lg:w-18" : "lg:w-60"
        }`}
      >
        {renderSidebar(false)}
      </aside>

      {/* Mobile drawer — always full-width/expanded regardless of the desktop
          collapse preference. */}
      {open && (
        <div className="lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-20 bg-surface-inverse/40"
          />
          <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-default bg-surface-raised">
            {renderSidebar(true)}
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

          {/* Mobile: brand, linked home same as the sidebar mark. Desktop: current page title. */}
          <Link href="/" className="font-semibold tracking-tight text-primary lg:hidden">
            {brand}
          </Link>
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

        {/* Side padding scales down on small screens and caps out on very
            wide ones — max-w-7xl (not 5xl) so content doesn't leave huge
            empty gutters next to the sidebar on a normal desktop window. */}
        <main className="flex-1 px-3 py-6 sm:px-5 sm:py-8 lg:px-6 xl:px-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
