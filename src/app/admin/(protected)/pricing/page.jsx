import { IndianRupee, Coins, Landmark, Wallet, Gift } from "lucide-react";
import { requireAdmin } from "../../../../lib/auth/guards";
import { getSettings, inr } from "../../../../lib/settings";
import PricingForm from "../../../../components/admin/PricingForm";

export const metadata = { title: "Pricing · Admin", robots: { index: false } };

const STATS = [
  { key: "reviewRate", label: "Business pays / review", icon: IndianRupee },
  { key: "reviewerReward", label: "Reviewer earns / verified review", icon: Coins },
  { key: "minWithdrawal", label: "Minimum withdrawal", icon: Landmark },
  { key: "minTopup", label: "Minimum wallet top-up", icon: Wallet },
  { key: "referralReward", label: "Referral bonus", icon: Gift },
];

export default async function AdminPricingPage() {
  await requireAdmin();
  const settings = await getSettings();

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-primary">Pricing control</h1>
      <p className="mt-2 max-w-2xl text-secondary">
        The single place platform pricing lives. Changes apply everywhere — new campaigns use the
        review rate, and verified reviewers are paid the reward.
      </p>

      {/* One row on desktop — 5 numbers, meant to be scanned at a glance, not stacked. */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {STATS.map(({ key, label, icon: Icon }) => (
          <div
            key={key}
            className="rounded-card border border-default bg-surface-raised p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-md"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-subtle text-accent">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <p className="mt-2.5 text-xs font-medium leading-tight text-secondary">{label}</p>
            <p className="nums mt-1 text-xl font-bold text-primary">{inr(settings[key])}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-card border border-default bg-surface-raised p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-bold text-primary">Edit pricing</h2>
        <div className="mt-4">
          <PricingForm initial={settings} />
        </div>
      </div>
    </div>
  );
}
