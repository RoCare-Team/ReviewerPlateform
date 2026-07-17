import AppShell from "../../../components/shell/AppShell";
import { requireRole } from "../../../lib/auth/guards";
import { ROLES } from "../../../lib/auth/roles";

// reviewer only.
//
// ★ Nav mirrors the permission scope in data/roles.json: feedback:submit,
//   profile:read, profile:update. There is deliberately no "post a review" or
//   "withdraw rewards" entry — the reviewer role cannot do either, and a nav
//   item implying otherwise is the compliance story leaking. Check the
//   permissions array before adding anything here.
const NAV = [
  { href: "/reviewer", label: "Overview", icon: "dashboard" },
  { href: "/reviewer/feedback", label: "My feedback", icon: "feedback", soon: true },
  { href: "/reviewer/profile", label: "Profile", icon: "profile", soon: true },
];

export default async function ReviewerLayout({ children }) {
  const user = await requireRole(ROLES.REVIEWER);

  return (
    <AppShell brand="ReviewHub" nav={NAV} user={{ email: user.email }}>
      {children}
    </AppShell>
  );
}
