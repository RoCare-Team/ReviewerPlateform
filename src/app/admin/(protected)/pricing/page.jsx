import { requireAdmin } from "../../../../lib/auth/guards";
import { getSettings, inr } from "../../../../lib/settings";
import PricingForm from "../../../../components/admin/PricingForm";

export const metadata = { title: "Pricing · Admin", robots: { index: false } };

export default async function AdminPricingPage() {
  await requireAdmin();
  const settings = await getSettings();

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-primary">Pricing control</h1>
      <p className="mt-2 text-secondary">
        The single place platform pricing lives. Changes apply everywhere — new campaigns use the
        review rate, and verified reviewers are paid the reward.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:max-w-4xl">
        <div className="rounded-card border border-default bg-surface-raised p-5 shadow-sm">
          <p className="text-sm text-secondary">Business pays / review</p>
          <p className="mt-1 text-2xl font-bold text-primary">{inr(settings.reviewRate)}</p>
        </div>
        <div className="rounded-card border border-default bg-surface-raised p-5 shadow-sm">
          <p className="text-sm text-secondary">Reviewer earns / verified review</p>
          <p className="mt-1 text-2xl font-bold text-primary">{inr(settings.reviewerReward)}</p>
        </div>
        <div className="rounded-card border border-default bg-surface-raised p-5 shadow-sm">
          <p className="text-sm text-secondary">Minimum withdrawal</p>
          <p className="mt-1 text-2xl font-bold text-primary">{inr(settings.minWithdrawal)}</p>
        </div>
        <div className="rounded-card border border-default bg-surface-raised p-5 shadow-sm">
          <p className="text-sm text-secondary">Minimum wallet top-up</p>
          <p className="mt-1 text-2xl font-bold text-primary">{inr(settings.minTopup)}</p>
        </div>
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
