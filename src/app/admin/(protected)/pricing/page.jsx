import { IndianRupee, Coins, Landmark, Wallet, Gift, Timer } from "lucide-react";
import { requireAdmin } from "../../../../lib/auth/guards";
import { getSettings, inr } from "../../../../lib/settings";
import PricingForm from "../../../../components/admin/PricingForm";

export const metadata = { title: "Pricing & limits · Admin", robots: { index: false } };

// `format` defaults to rupees — every stat here is a price except the
// cooldown, which is hours and would read as "₹4" without its own formatter.
const STATS = [
  { key: "reviewRate", label: "Business pays / review", icon: IndianRupee },
  { key: "reviewerReward", label: "Reviewer earns / verified review", icon: Coins },
  { key: "minWithdrawal", label: "Minimum withdrawal", icon: Landmark },
  { key: "minTopup", label: "Minimum wallet top-up", icon: Wallet },
  { key: "referralReward", label: "Referral bonus", icon: Gift },
  {
    key: "reviewerCooldownHours",
    label: "Gap between a reviewer’s reviews",
    icon: Timer,
    format: (v) => (Number(v) > 0 ? `${v}h` : "Off"),
  },
];

export default async function AdminPricingPage() {
  await requireAdmin();
  const settings = await getSettings();

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-primary">Pricing &amp; limits</h1>
      <p className="mt-2 max-w-2xl text-secondary">
        The single place platform pricing and reviewer pacing live. Changes apply everywhere — new
        campaigns use the review rate, verified reviewers are paid the reward, and every reviewer
        has to leave the cooldown gap between one submission and the next.
      </p>

      {/* One row on desktop — six figures, meant to be scanned at a glance, not stacked. */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {STATS.map(({ key, label, icon: Icon, format }) => (
          <div
            key={key}
            className="rounded-card border border-default bg-surface-raised p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-md"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-subtle text-accent">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <p className="mt-2.5 text-xs font-medium leading-tight text-secondary">{label}</p>
            <p className="nums mt-1 text-xl font-bold text-primary">
              {format ? format(settings[key]) : inr(settings[key])}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-card border border-default bg-surface-raised p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-bold text-primary">Edit pricing &amp; limits</h2>
        <div className="mt-4">
          <PricingForm initial={settings} />
        </div>
      </div>
    </div>
  );
}
