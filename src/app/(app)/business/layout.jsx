import AppShell from "../../../components/shell/AppShell";
import { requireRole } from "../../../lib/auth/guards";
import { ROLES } from "../../../lib/auth/roles";
import dbConnect from "../../../lib/db";
import User from "../../../models/User";

// business_owner only. Re-checked here even though (app)/layout ran requireAuth
// and middleware matched the prefix — each layer narrows, none is trusted alone.
//
// Only Overview exists today; the rest are `soon` rather than links to 404s.
const NAV = [
  { href: "/business", label: "Overview", icon: "dashboard" },
  { href: "/business/feedback", label: "Feedback", icon: "feedback" },
  { href: "/business/reviews", label: "Reviews", icon: "reviews" },
  { href: "/business/campaigns", label: "Campaigns", icon: "campaigns" },
  { href: "/business/connections", label: "Connections", icon: "connections" },
  { href: "/business/settings", label: "Settings", icon: "settings" },
];

export default async function BusinessLayout({ children }) {
  const user = await requireRole(ROLES.BUSINESS_OWNER);

  await dbConnect();
  const me = await User.findById(user.id).select("walletBalance").lean();

  return (
    <AppShell
      brand="ReviewHub Business"
      nav={NAV}
      user={{ name: user.name, email: user.email }}
      profileHref="/business/settings"
      walletBalance={me?.walletBalance ?? 0}
      walletHref="/business/settings"
    >
      {children}
    </AppShell>
  );
}
