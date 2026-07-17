import AppShell from "../../../components/shell/AppShell";
import { requireRole } from "../../../lib/auth/guards";
import { ROLES } from "../../../lib/auth/roles";

// business_owner only. Re-checked here even though (app)/layout ran requireAuth
// and middleware matched the prefix — each layer narrows, none is trusted alone.
//
// Only Overview exists today; the rest are `soon` rather than links to 404s.
const NAV = [
  { href: "/business", label: "Overview", icon: "dashboard" },
  { href: "/business/feedback", label: "Feedback", icon: "feedback", soon: true },
  { href: "/business/reviews", label: "Reviews", icon: "reviews", soon: true },
  { href: "/business/campaigns", label: "Campaigns", icon: "campaigns", soon: true },
  { href: "/business/connections", label: "Connections", icon: "connections", soon: true },
  { href: "/business/settings", label: "Settings", icon: "settings", soon: true },
];

export default async function BusinessLayout({ children }) {
  const user = await requireRole(ROLES.BUSINESS_OWNER);

  return (
    <AppShell brand="ReviewHub Business" nav={NAV} user={{ email: user.email }}>
      {children}
    </AppShell>
  );
}
