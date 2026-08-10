import AppShell from "../../../components/shell/AppShell";
import LocationGate from "../../../components/reviewer/LocationGate";
import { requireRole } from "../../../lib/auth/guards";
import { ROLES } from "../../../lib/auth/roles";
import { getContact } from "../../../lib/contact";
import dbConnect from "../../../lib/db";
import User from "../../../models/User";

const BRAND_NAME = getContact("brand.productName", "RapportLook");

// reviewer only.
//
// ★ Nav mirrors the permission scope in data/roles.json: feedback:submit,
//   profile:read, profile:update, reward:withdraw. There is deliberately no
//   "post a review" entry — the reviewer role cannot do that, and a nav item
//   implying otherwise is the compliance story leaking. Check the permissions
//   array before adding anything here.
const NAV = [
  { href: "/reviewer", label: "Overview", icon: "dashboard" },
  { href: "/reviewer/campaigns", label: "Campaigns", icon: "campaigns" },
  { href: "/reviewer/feedback", label: "My feedback", icon: "feedback" },
  { href: "/reviewer/withdraw", label: "Withdraw", icon: "withdraw" },
  { href: "/reviewer/profile", label: "Profile", icon: "profile" },
];

export default async function ReviewerLayout({ children }) {
  const user = await requireRole(ROLES.REVIEWER);

  await dbConnect();
  const me = await User.findById(user.id).select("walletBalance location").lean();

  // Mandatory gate — every /reviewer/* route (not just the dashboard) is
  // blocked until a location is on file, since campaigns are matched to
  // reviewers by city. Replaces the whole shell, not just the page body, so
  // there's no way to navigate around it via a direct URL.
  //
  // Gated on `updatedAt` (set whenever the coordinates were successfully
  // saved), NOT on `city` — reverse geocoding (lib/googleMaps.js) can come
  // back empty (no API key configured, rate-limited, a rural/unmapped spot)
  // even though the reviewer genuinely granted permission. Requiring `city`
  // specifically would trap them behind the gate forever with no way out.
  if (!me?.location?.updatedAt) {
    return <LocationGate />;
  }

  return (
    <AppShell
      brand={BRAND_NAME}
      nav={NAV}
      user={{ name: user.name, phone: user.phone }}
      profileHref="/reviewer/profile"
      // Same wallet field the business shell shows, framed as coins EARNED —
      // a reviewer accrues this from verified work, they don't fund from it.
      // Links to Withdraw, where that balance can actually be cashed out.
      walletBalance={me?.walletBalance ?? 0}
      walletVariant="coins"
      walletHref="/reviewer/withdraw"
    >
      {children}
    </AppShell>
  );
}
