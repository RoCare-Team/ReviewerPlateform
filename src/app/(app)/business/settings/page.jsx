import { UserRound, Wallet } from "lucide-react";
import { requireRole } from "../../../../lib/auth/guards";
import { ROLES } from "../../../../lib/auth/roles";
import dbConnect from "../../../../lib/db";
import User from "../../../../models/User";
import WalletTransaction from "../../../../models/WalletTransaction";
import { getSettings, inr } from "../../../../lib/settings";
import ProfileForm from "../../../../components/reviewer/ProfileForm";
import WalletCard from "../../../../components/business/WalletCard";
import ReferralCard from "../../../../components/shared/ReferralCard";
import { generateUniqueReferralCode } from "../../../../lib/referral";

export const metadata = { title: "Settings · RapportLook Business" };

export default async function BusinessSettingsPage() {
  const sessionUser = await requireRole(ROLES.BUSINESS_OWNER);

  await dbConnect();
  let doc = await User.findById(sessionUser.id).select("name phone bio walletBalance referralCode").lean();

  // Backfill for accounts created before the referral program existed.
  if (doc && !doc.referralCode) {
    const code = await generateUniqueReferralCode();
    await User.updateOne({ _id: sessionUser.id, referralCode: { $exists: false } }, { $set: { referralCode: code } });
    doc = { ...doc, referralCode: code };
  }
  const txns = await WalletTransaction.find({ user: sessionUser.id }).sort({ createdAt: -1 }).limit(10).lean();
  const settings = await getSettings();
  const { minTopup } = settings;
  const referredCount = await User.countDocuments({ referredBy: sessionUser.id });

  const initial = {
    name: doc?.name ?? "",
    phone: doc?.phone ?? sessionUser.phone ?? "",
    bio: doc?.bio ?? "",
  };

  const transactions = txns.map((t) => ({
    id: String(t._id),
    amount: t.amount,
    type: t.type,
    note: t.note,
    at: t.createdAt.toISOString(),
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-primary">Settings</h1>
      <p className="mt-2 text-secondary">Manage your account and billing.</p>

      {/* Wallet */}
      <div className="mt-8">
        <h2 className="flex items-center gap-2 text-lg font-bold text-primary">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-subtle">
            <Wallet className="h-4 w-4 text-accent" aria-hidden="true" />
          </span>
          Wallet
        </h2>
        <div className="mt-4">
          <WalletCard balance={doc?.walletBalance ?? 0} transactions={transactions} minTopup={minTopup} />
        </div>
      </div>

      {/* Profile */}
      <div className="mt-10">
        <h2 className="flex items-center gap-2 text-lg font-bold text-primary">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-subtle">
            <UserRound className="h-4 w-4 text-accent" aria-hidden="true" />
          </span>
          Profile
        </h2>
        <div className="mt-4 rounded-card border border-default bg-surface-raised p-6 shadow-sm transition-shadow duration-300 hover:shadow-md sm:p-8">
          <ProfileForm initial={initial} endpoint="/api/business/profile" />
        </div>
      </div>

      {/* Invite & earn */}
      <div className="mt-10">
        <ReferralCard
          code={doc?.referralCode}
          signupPath="/signup/business"
          rewardDisplay={inr(settings.referralReward)}
          referredCount={referredCount}
          appUrl={process.env.APP_URL ?? "http://localhost:3000"}
        />
      </div>
    </div>
  );
}
