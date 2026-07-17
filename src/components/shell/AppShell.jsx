"use client";

import {
  Building2,
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

export default function AppShell({ brand, badge, nav, user, signOutTo = "/", children }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // A route change must close the drawer, or the new page renders underneath it.
  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href) => pathname === href || pathname.startsWith(href + "/");

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
    <div className="min-h-dvh lg:flex">
      {/* Desktop rail */}
      <aside className="hidden w-60 shrink-0 border-r border-default bg-surface-raised lg:flex lg:flex-col">
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

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar — the only way to reach the drawer. */}
        <header className="flex items-center gap-3 border-b border-default bg-surface-raised px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            className="rounded-btn border border-default p-1.5 text-secondary transition hover:bg-surface-sunken hover:text-primary"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <span className="font-semibold tracking-tight text-primary">{brand}</span>
          {badge && (
            <span className="rounded bg-danger-subtle px-1.5 py-0.5 text-xs font-medium text-danger">
              {badge}
            </span>
          )}
        </header>

        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
