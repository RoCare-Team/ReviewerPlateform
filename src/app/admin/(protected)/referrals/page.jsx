import { requireAdmin } from "../../../../lib/auth/guards";
import dbConnect from "../../../../lib/db";
import User from "../../../../models/User";
import { getSettings } from "../../../../lib/settings";
import { referralStatus } from "../../../../lib/referral";
import ReferralQueue from "../../../../components/admin/ReferralQueue";

export const metadata = { title: "Referrals · Admin", robots: { index: false } };

/**
 * Every referral in the system, newest first, with its credit either already
 * settled or waiting on a decision.
 *
 * A referral lives on the REFERRED user's document (models/User.js), so the
 * query is simply "everyone who signed up with somebody's code". The referrer
 * is resolved in one extra read rather than a populate, same shape as the
 * withdrawals page.
 *
 * Why this page exists: the automatic rule pays on an app install, and the
 * install is only visible when the app declares itself (lib/clientPlatform.js).
 * A build that declares nothing makes a genuine installer look like a website
 * signup — the referrer sees "web only — no app yet" and never gets paid.
 * This is where that gets corrected by hand.
 */
export default async function AdminReferralsPage() {
  await requireAdmin();
  await dbConnect();

  const [docs, settings] = await Promise.all([
    User.find({ referredBy: { $ne: null } })
      .sort({ createdAt: -1 })
      .limit(500)
      .select(
        "name phone role createdAt signupSource appInstalledAt appPlatform referredBy referralBonusPaid referralBonusPaidAt referralBonusApprovedBy referralBonusRejectedAt referralBonusNote"
      )
      .lean(),
    getSettings(),
  ]);

  const referrers = await User.find({ _id: { $in: docs.map((d) => d.referredBy) } })
    .select("name phone role referralCode")
    .lean();
  const rMap = new Map(referrers.map((r) => [String(r._id), r]));

  const fmt = (d) => (d ? new Date(d).toLocaleString("en-IN") : "");

  const rows = docs.map((u) => {
    const referrer = rMap.get(String(u.referredBy));
    return {
      id: String(u._id),
      name: u.name || "New user",
      phone: u.phone || "",
      role: u.role,
      joined: fmt(u.createdAt),
      signupSource: u.signupSource || "web",
      // The two independent signals an admin weighs before approving: was the
      // account ever seen on the app, and when.
      installedApp: Boolean(u.appInstalledAt) || ["android", "ios"].includes(u.signupSource),
      installedAt: fmt(u.appInstalledAt),
      status: referralStatus(u),
      paidAt: fmt(u.referralBonusPaidAt),
      // Set only when a human credited it — worth showing apart from a payout
      // the install rule made on its own.
      manual: Boolean(u.referralBonusApprovedBy),
      rejectedAt: fmt(u.referralBonusRejectedAt),
      note: u.referralBonusNote || "",
      referrerName: referrer?.name || "(deleted account)",
      referrerPhone: referrer?.phone || "",
      referrerCode: referrer?.referralCode || "",
    };
  });

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-primary">Referrals</h1>
      <p className="mt-2 text-secondary">
        Who joined with whose code, and whether the {`₹${settings.referralReward}`} credit has been
        released. The bonus pays itself the moment the new account is seen on the app — approve one
        by hand when that signal missed a real install, or reject it to settle it as ineligible.
      </p>

      <div className="mt-8">
        <ReferralQueue rows={rows} reward={settings.referralReward} />
      </div>
    </div>
  );
}
