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
import { getReferralSummary, getReferralHistory } from "../../../../lib/referral";

export const metadata = { title: "Settings · RapportLook Business" };

export default async function BusinessSettingsPage() {
  const sessionUser = await requireRole(ROLES.BUSINESS_OWNER);

  await dbConnect();
  let doc = await User.findById(sessionUser.id).select("name phone bio walletBalance referralCode").lean();

  // Summary handles the lazy code backfill for accounts older than the
  // referral program, and builds the Play Store share link — see
  // lib/referral.js. History is what the owner sees under the card.
  const [referral, referralHistory] = await Promise.all([
    getReferralSummary(sessionUser.id, doc?.referralCode),
    getReferralHistory(sessionUser.id),
  ]);
  const txns = await WalletTransaction.find({ user: sessionUser.id }).sort({ createdAt: -1 }).limit(10).lean();
  const settings = await getSettings();
  const { minTopup } = settings;

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
          code={referral.referralCode}
          rewardDisplay={inr(referral.referralReward)}
          referredCount={referral.referredCount}
          installedCount={referral.installedCount}
          paidCount={referral.paidCount}
          pendingCount={referral.pendingCount}
          referralLink={referral.referralLink}
          webSignupLink={referral.webSignupLink}
          history={referralHistory}
        />
      </div>
    </div>
  );
}
