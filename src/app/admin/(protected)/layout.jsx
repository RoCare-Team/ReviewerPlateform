import AppShell from "../../../components/shell/AppShell";
import { requireAdmin } from "../../../lib/auth/guards";
import { getContact } from "../../../lib/contact";

const BRAND_NAME = getContact("brand.productName", "RapportLook");

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
  { href: "/admin/verification", label: "Verification", icon: "moderation" },
  { href: "/admin/withdrawals", label: "Withdrawals", icon: "withdraw" },
  { href: "/admin/campaigns", label: "Campaigns", icon: "campaigns" },
  { href: "/admin/users", label: "Users", icon: "users" },
  { href: "/admin/organisations", label: "Businesses", icon: "organisations" },
  { href: "/admin/pricing", label: "Pricing", icon: "payments" },
];

export default async function ProtectedAdminLayout({ children }) {
  const user = await requireAdmin();

  return (
    <AppShell
      brand={BRAND_NAME}
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
