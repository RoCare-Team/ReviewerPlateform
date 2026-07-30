import Link from "next/link";
import { Wallet, Gift, CheckCircle2, Clock, ArrowRight, Star } from "lucide-react";
import { requireRole } from "../../../lib/auth/guards";
import { ROLES } from "../../../lib/auth/roles";

export const metadata = { title: "Your feedback · ReviewHub" };

// Dummy figures — placeholder until wallet/points are wired to the DB.
const STATS = [
  { key: "balance", label: "Wallet balance", value: "₹1,250", Icon: Wallet, tone: "text-accent" },
  { key: "points", label: "Reward points", value: "2,300", Icon: Gift, tone: "text-accent" },
  { key: "completed", label: "Reviews completed", value: "24", Icon: CheckCircle2, tone: "text-verified" },
  { key: "pending", label: "Reviews pending", value: "3", Icon: Clock, tone: "text-pending" },
];

const CAMPAIGNS = [
  { id: "c1", business: "Cafe Aromas", platform: "Google", reward: 50 },
  { id: "c2", business: "TechFix Services", platform: "Trustpilot", reward: 60 },
  { id: "c3", business: "BrightSmile Dental", platform: "Google", reward: 50 },
];

export default async function ReviewerHomePage() {
  const user = await requireRole(ROLES.REVIEWER);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-primary">
        Hi{user.name ? `, ${user.name}` : ""}
      </h1>
      <p className="mt-2 text-secondary">
        Here&apos;s your participation summary. Rewards are for verified participation, never for
        positive ratings.
      </p>

      {/* Stat widgets */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map(({ key, label, value, Icon, tone }) => (
          <div key={key} className="rounded-card border border-default bg-surface-raised p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm text-secondary">{label}</span>
              <Icon className={`h-5 w-5 ${tone}`} aria-hidden="true" />
            </div>
            <p className="mt-3 text-3xl font-extrabold tracking-tight text-primary">{value}</p>
          </div>
        ))}
      </div>

      {/* Available campaigns */}
      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-primary">Available campaigns</h2>
          <Link href="/reviewer/feedback" className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">
            My feedback
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAMPAIGNS.map((c) => (
            <li key={c.id} className="rounded-card border border-default bg-surface-raised p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">{c.platform}</span>
              </div>
              <h3 className="mt-2 text-base font-bold text-primary">{c.business}</h3>
              <p className="mt-1 text-sm text-secondary">Earn {c.reward} points for verified participation.</p>
              <button
                type="button"
                className="mt-4 w-full rounded-btn bg-accent px-4 py-2 text-sm font-semibold text-on-brand shadow-sm transition hover:bg-accent-hover"
              >
                Join campaign
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
