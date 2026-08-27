import { requireRole } from "../../../../lib/auth/guards";
import { ROLES } from "../../../../lib/auth/roles";
import dbConnect from "../../../../lib/db";
import User from "../../../../models/User";
import { inr } from "../../../../lib/settings";
import ProfileForm from "../../../../components/reviewer/ProfileForm";
import LocationCard from "../../../../components/reviewer/LocationCard";
import ReferralCard from "../../../../components/shared/ReferralCard";
import { getReferralSummary, getReferralHistory } from "../../../../lib/referral";

export const metadata = { title: "Profile · RapportLook" };

export default async function ReviewerProfilePage() {
  const sessionUser = await requireRole(ROLES.REVIEWER);

  // Read the full record so name/phone/bio reflect the latest saved values
  // (the session JWT only carries id/role/status/phone).
  await dbConnect();
  const doc = await User.findById(sessionUser.id)
    .select("name phone bio location referralCode")
    .lean();

  // getReferralSummary() does the lazy code backfill for accounts older than
  // the referral program, and builds the Play Store share link — the reward
  // is paid on an app install, so that is what gets shared. See lib/referral.js.
  const [referral, referralHistory] = await Promise.all([
    getReferralSummary(sessionUser.id, doc?.referralCode),
    getReferralHistory(sessionUser.id),
  ]);

  const initial = {
    name: doc?.name ?? "",
    phone: doc?.phone ?? sessionUser.phone ?? "",
    bio: doc?.bio ?? "",
  };

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-primary">Profile</h1>
      <p className="mt-2 text-secondary">Manage your account details.</p>

      <div className="mt-8 space-y-6">
        <div className="rounded-card border border-default bg-surface-raised p-6 shadow-sm sm:p-8">
          <ProfileForm initial={initial} />
        </div>

        {/* Reviewer-only — city is mandatory at signup (PhoneOtpForm.jsx),
            so it's always here for any account created after that change. */}
        <LocationCard city={doc?.location?.city} updatedAt={doc?.location?.updatedAt} />

        <ReferralCard
          code={referral.referralCode}
          rewardDisplay={inr(referral.referralReward)}
          referredCount={referral.referredCount}
          installedCount={referral.installedCount}
          paidCount={referral.paidCount}
          referralLink={referral.referralLink}
          webSignupLink={referral.webSignupLink}
          history={referralHistory}
        />
      </div>
    </div>
  );
}
