import AppShell from "../../../components/shell/AppShell";
import { requireAdmin } from "../../../lib/auth/guards";

/**
 * Guards every admin route except /admin/login (which sits outside this group).
 *
 * requireAdmin() redirects to /admin/login rather than /login — admin has its own
 * door. This is the authority; middleware only did an optimistic JWT check. Stays
 * a server component: AppShell is client-side and must never be handed an auth
 * decision.
 *
 * Everything below Overview is designed but not built yet — marked `soon` so the
 * panel's shape is visible without linking to 404s. Drop the flag as each lands.
 */
const NAV = [
  { href: "/admin", label: "Overview", icon: "dashboard" },
  { href: "/admin/users", label: "Users", icon: "users", soon: true },
  { href: "/admin/organisations", label: "Organisations", icon: "organisations", soon: true },
  { href: "/admin/moderation", label: "Moderation", icon: "moderation", soon: true },
  { href: "/admin/payments", label: "Payments", icon: "payments", soon: true },
  { href: "/admin/trust-safety", label: "Trust & Safety", icon: "trust", soon: true },
];

export default async function ProtectedAdminLayout({ children }) {
  const user = await requireAdmin();

  return (
    <AppShell
      brand="ReviewHub"
      badge="ADMIN"
      nav={NAV}
      user={{ email: user.email }}
      // Back to the admin door, not the public homepage.
      signOutTo="/admin/login"
    >
      {children}
    </AppShell>
  );
}
