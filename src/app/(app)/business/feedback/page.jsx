import { MessageSquare, Smile, Meh, Frown } from "lucide-react";
import { requireRole } from "../../../../lib/auth/guards";
import { ROLES } from "../../../../lib/auth/roles";

export const metadata = { title: "Feedback · ReviewHub Business" };

// Dummy data — private, first-party customer feedback (NOT public reviews).
const FEEDBACK = [
  { id: "b1", customer: "Aarav S.", sentiment: "positive", nps: 9, text: "Loved the onboarding — clear and quick.", date: "2026-07-18" },
  { id: "b2", customer: "Meera P.", sentiment: "neutral", nps: 7, text: "Works fine, wish support replied faster.", date: "2026-07-17" },
  { id: "b3", customer: "Sana M.", sentiment: "negative", nps: 4, text: "Delivery was delayed, please improve tracking.", date: "2026-07-16" },
  { id: "b4", customer: "Rohit K.", sentiment: "positive", nps: 10, text: "Best in class, will recommend to my team.", date: "2026-07-15" },
];

const SENTIMENT = {
  positive: { Icon: Smile, cls: "text-verified", label: "Positive" },
  neutral: { Icon: Meh, cls: "text-pending", label: "Neutral" },
  negative: { Icon: Frown, cls: "text-danger", label: "Negative" },
};

const SUMMARY = [
  { label: "Responses", value: "184" },
  { label: "Avg NPS", value: "42" },
  { label: "Positive", value: "68%" },
];

export default async function BusinessFeedbackPage() {
  await requireRole(ROLES.BUSINESS_OWNER);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-primary">Feedback</h1>
      <p className="mt-2 text-secondary">
        Private customer satisfaction and NPS feedback — collected first-party, never posted publicly.
      </p>

      {/* Summary */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {SUMMARY.map((s) => (
          <div key={s.label} className="rounded-card border border-default bg-surface-raised p-5 shadow-sm">
            <p className="text-sm text-secondary">{s.label}</p>
            <p className="mt-2 text-3xl font-extrabold tracking-tight text-primary">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Feedback list */}
      <ul className="mt-8 space-y-4">
        {FEEDBACK.map((f) => {
          const s = SENTIMENT[f.sentiment];
          return (
            <li key={f.id} className="rounded-card border border-default bg-surface-raised p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <s.Icon className={`h-5 w-5 ${s.cls}`} aria-hidden="true" />
                  <span className="text-sm font-bold text-primary">{f.customer}</span>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted">
                  <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                  NPS {f.nps}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-secondary">{f.text}</p>
              <p className="mt-2 text-xs text-muted">{f.date}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
