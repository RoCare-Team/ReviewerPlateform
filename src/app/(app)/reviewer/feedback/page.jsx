import { Star } from "lucide-react";
import { requireRole } from "../../../../lib/auth/guards";
import { ROLES } from "../../../../lib/auth/roles";

export const metadata = { title: "My feedback · ReviewHub" };

// Dummy data — placeholder until submissions are wired to the DB.
const FEEDBACK = [
  { id: "f1", business: "Cafe Aromas", platform: "Google", rating: 5, status: "approved", points: 50, date: "2026-07-18" },
  { id: "f2", business: "TechFix Services", platform: "Trustpilot", rating: 4, status: "approved", points: 50, date: "2026-07-15" },
  { id: "f3", business: "GreenLeaf Clinic", platform: "Google", rating: 5, status: "pending", points: 0, date: "2026-07-14" },
  { id: "f4", business: "UrbanWear", platform: "Amazon", rating: 3, status: "approved", points: 50, date: "2026-07-10" },
  { id: "f5", business: "QuickBite Delivery", platform: "Flipkart", rating: 4, status: "rejected", points: 0, date: "2026-07-08" },
  { id: "f6", business: "BrightSmile Dental", platform: "Google", rating: 5, status: "approved", points: 50, date: "2026-07-05" },
];

const STATUS_STYLES = {
  approved: "pill-verified",
  pending: "pill-pending",
  rejected: "pill-danger",
};

function Stars({ n }) {
  return (
    <span className="inline-flex" aria-label={`${n} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i < n ? "fill-amber-400 text-amber-400" : "text-default"}`}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

export default async function ReviewerFeedbackPage() {
  await requireRole(ROLES.REVIEWER);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-primary">My feedback</h1>
      <p className="mt-2 text-secondary">
        Every review you&apos;ve submitted and its verification status.
      </p>

      {/* Desktop table */}
      <div className="mt-8 hidden overflow-hidden rounded-card border border-default bg-surface-raised shadow-sm sm:block">
        <table className="w-full text-sm">
          <thead className="border-b border-default bg-surface-sunken text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3 font-semibold">Business</th>
              <th className="px-5 py-3 font-semibold">Platform</th>
              <th className="px-5 py-3 font-semibold">Rating</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Points</th>
              <th className="px-5 py-3 font-semibold">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-default">
            {FEEDBACK.map((f) => (
              <tr key={f.id} className="transition hover:bg-surface-sunken/50">
                <td className="px-5 py-3.5 font-semibold text-primary">{f.business}</td>
                <td className="px-5 py-3.5 text-secondary">{f.platform}</td>
                <td className="px-5 py-3.5"><Stars n={f.rating} /></td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[f.status]}`}>
                    {f.status}
                  </span>
                </td>
                <td className="px-5 py-3.5 font-semibold text-primary">{f.points ? `+${f.points}` : "—"}</td>
                <td className="px-5 py-3.5 text-muted">{f.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="mt-8 space-y-3 sm:hidden">
        {FEEDBACK.map((f) => (
          <li key={f.id} className="rounded-card border border-default bg-surface-raised p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-primary">{f.business}</span>
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[f.status]}`}>
                {f.status}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm text-secondary">
              <span>{f.platform}</span>
              <Stars n={f.rating} />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted">
              <span>{f.date}</span>
              <span className="font-semibold text-primary">{f.points ? `+${f.points} pts` : "—"}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
