import Image from "next/image";
import { requireRole } from "../../../../lib/auth/guards";
import { ROLES } from "../../../../lib/auth/roles";
import dbConnect from "../../../../lib/db";
import Submission from "../../../../models/Submission";
import Campaign from "../../../../models/Campaign";
import { inr } from "../../../../lib/settings";

export const metadata = { title: "My submissions · ReviewHub" };

const STATUS_STYLES = { approved: "pill-verified", pending: "pill-pending", rejected: "pill-danger" };

export default async function ReviewerFeedbackPage() {
  const user = await requireRole(ROLES.REVIEWER);

  await dbConnect();
  const subs = await Submission.find({ reviewer: user.id }).sort({ createdAt: -1 }).lean();
  const campaigns = await Campaign.find({ _id: { $in: subs.map((s) => s.campaign) } }).select("name platform").lean();
  const cMap = new Map(campaigns.map((c) => [String(c._id), c]));

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-primary">My submissions</h1>
      <p className="mt-2 text-secondary">Reviews you&apos;ve submitted and their verification status.</p>

      {subs.length === 0 ? (
        <div className="mt-8 rounded-card border border-dashed border-default bg-surface-raised p-10 text-center">
          <p className="text-sm text-secondary">No submissions yet. Join a campaign from your dashboard.</p>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {subs.map((s) => {
            const c = cMap.get(String(s.campaign));
            return (
              <li key={String(s._id)} className="rounded-card border border-default bg-surface-raised p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <a href={s.screenshotUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                      <Image
                        src={s.screenshotUrl}
                        alt="Review screenshot"
                        width={64}
                        height={64}
                        className="h-16 w-16 rounded-btn border border-default object-cover"
                        unoptimized
                      />
                    </a>
                    <div>
                      <p className="text-sm font-bold text-primary">{c?.name ?? "Campaign"}</p>
                      <p className="text-xs capitalize text-muted">{c?.platform ?? ""} · {new Date(s.createdAt).toLocaleDateString("en-IN")}</p>
                      {s.note && <p className="mt-1 text-sm text-secondary">{s.note}</p>}
                      {s.status === "rejected" && s.rejectionReason && (
                        <p className="mt-1 text-xs text-danger">Reason: {s.rejectionReason}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[s.status]}`}>
                      {s.status}
                    </span>
                    {s.status === "approved" && (
                      <p className="mt-1 text-sm font-bold text-verified">+{inr(s.rewardAmount)}</p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
