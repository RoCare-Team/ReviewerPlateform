import AppShell from "../../../components/shell/AppShell";
import { requireRole } from "../../../lib/auth/guards";
import { ROLES } from "../../../lib/auth/roles";
import dbConnect from "../../../lib/db";
import User from "../../../models/User";

// reviewer only.
//
// ★ Nav mirrors the permission scope in data/roles.json: feedback:submit,
//   profile:read, profile:update. There is deliberately no "post a review" or
//   "withdraw rewards" entry — the reviewer role cannot do either, and a nav
//   item implying otherwise is the compliance story leaking. Check the
//   permissions array before adding anything here.
const NAV = [
  { href: "/reviewer", label: "Overview", icon: "dashboard" },
  { href: "/reviewer/feedback", label: "My feedback", icon: "feedback" },
  { href: "/reviewer/profile", label: "Profile", icon: "profile" },
];

export default async function ReviewerLayout({ children }) {
  const user = await requireRole(ROLES.REVIEWER);

  await dbConnect();
  const me = await User.findById(user.id).select("walletBalance").lean();

  return (
    <AppShell
      brand="ReviewHub"
      nav={NAV}
      user={{ name: user.name, email: user.email }}
      profileHref="/reviewer/profile"
      // Same wallet field the business shell shows, framed as coins EARNED —
      // a reviewer accrues this from verified work, they don't fund from it.
      // Links to My feedback, which itemises where each credit came from.
      walletBalance={me?.walletBalance ?? 0}
      walletVariant="coins"
      walletHref="/reviewer/feedback"
    >
      {children}
    </AppShell>
  );
}
