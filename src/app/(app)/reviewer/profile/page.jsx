import { requireRole } from "../../../../lib/auth/guards";
import { ROLES } from "../../../../lib/auth/roles";
import dbConnect from "../../../../lib/db";
import User from "../../../../models/User";
import { getSettings, inr } from "../../../../lib/settings";
import ProfileForm from "../../../../components/reviewer/ProfileForm";
import LocationCard from "../../../../components/reviewer/LocationCard";
import ReferralCard from "../../../../components/shared/ReferralCard";
import { generateUniqueReferralCode } from "../../../../lib/referral";

export const metadata = { title: "Profile · RapportLook" };

export default async function ReviewerProfilePage() {
  const sessionUser = await requireRole(ROLES.REVIEWER);

  // Read the full record so name/phone/bio reflect the latest saved values
  // (the session JWT only carries id/role/status/phone).
  await dbConnect();
  let [doc, settings, referredCount] = await Promise.all([
    User.findById(sessionUser.id).select("name phone bio location referralCode").lean(),
    getSettings(),
    User.countDocuments({ referredBy: sessionUser.id }),
  ]);

  // Backfill for accounts created before the referral program existed —
  // generate one lazily on first visit here rather than a one-off migration.
  if (doc && !doc.referralCode) {
    const code = await generateUniqueReferralCode();
    await User.updateOne({ _id: sessionUser.id, referralCode: { $exists: false } }, { $set: { referralCode: code } });
    doc = { ...doc, referralCode: code };
  }

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
          code={doc?.referralCode}
          signupPath="/signup/reviewer"
          rewardDisplay={inr(settings.referralReward)}
          referredCount={referredCount}
          appUrl={process.env.APP_URL ?? "http://localhost:3000"}
        />
      </div>
    </div>
  );
}
