import Image from "next/image";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  Inbox,
  MessageSquare,
  XCircle,
} from "lucide-react";
import { requireRole } from "../../../../lib/auth/guards";
import { ROLES } from "../../../../lib/auth/roles";
import dbConnect from "../../../../lib/db";
import Submission from "../../../../models/Submission";
import Campaign from "../../../../models/Campaign";
import User from "../../../../models/User";

export const metadata = { title: "Reviewer submissions · ReviewHub Business" };

const STATUS_STYLES = {
  approved: "pill-verified",
  pending: "pill-pending",
  rejected: "pill-danger",
};

const CAMPAIGN_STATUS_STYLES = {
  active: "pill-verified",
  paused: "pill-pending",
  draft: "pill-accent",
  completed: "pill-accent",
};

const PLATFORM_LABEL = {
  google: "Google",
  trustpilot: "Trustpilot",
  capterra: "Capterra",
  amazon: "Amazon",
  playstore: "Play Store",
};

function SummaryTile({ label, value, Icon, tone }) {
  return (
    <div className="rounded-card border border-default bg-surface-raised p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-sm text-secondary">{label}</p>
        <Icon className={`h-5 w-5 ${tone}`} aria-hidden="true" />
      </div>
      <p className="nums mt-3 text-3xl font-extrabold tracking-tight text-primary">{value}</p>
    </div>
  );
}

export default async function BusinessFeedbackPage() {
  const user = await requireRole(ROLES.BUSINESS_OWNER);

  await dbConnect();

  // Scoped to this owner on BOTH sides: campaigns by `user`, submissions by
  // `business`. A submission can only ever surface here for its own business.
  const [campaigns, submissions] = await Promise.all([
    Campaign.find({ user: user.id })
      .select("name platform status targetUrl targetReviews collected")
      .sort({ createdAt: -1 })
      .lean(),
    Submission.find({ business: user.id }).sort({ createdAt: -1 }).lean(),
  ]);

  // Reviewer names in one query rather than a populate per submission.
  // Name only — the business has no need for reviewer email addresses here.
  const reviewers = await User.find({ _id: { $in: submissions.map((s) => s.reviewer) } })
    .select("name")
    .lean();
  const reviewerName = new Map(reviewers.map((r) => [String(r._id), r.name]));

  // campaignId → submissions, newest first (the find() sort carries through).
  const byCampaign = new Map();
  for (const s of submissions) {
    const id = String(s.campaign);
    if (!byCampaign.has(id)) byCampaign.set(id, []);
    byCampaign.get(id).push(s);
  }

  const total = submissions.length;
  const approved = submissions.filter((s) => s.status === "approved").length;
  const pending = submissions.filter((s) => s.status === "pending").length;
  const rejected = submissions.filter((s) => s.status === "rejected").length;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-primary">Reviewer submissions</h1>
      <p className="mt-2 text-secondary">
        Every review submitted to your campaigns, with the screenshot proof and its verification
        status — grouped by campaign.
      </p>

      {/* Summary across all campaigns */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile label="Submissions" value={String(total)} Icon={MessageSquare} tone="text-accent" />
        <SummaryTile label="Verified" value={String(approved)} Icon={CheckCircle2} tone="text-verified" />
        <SummaryTile label="Awaiting verification" value={String(pending)} Icon={Clock} tone="text-pending" />
        <SummaryTile label="Rejected" value={String(rejected)} Icon={XCircle} tone="text-danger" />
      </div>

      {campaigns.length === 0 ? (
        <div className="mt-8 rounded-card border border-dashed border-default bg-surface-raised p-10 text-center">
          <Inbox className="mx-auto h-8 w-8 text-muted" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-primary">No campaigns yet</p>
          <p className="mt-1 text-sm text-secondary">
            Reviewer submissions show up here once you{" "}
            <Link href="/business/campaigns" className="font-semibold text-accent hover:underline">
              create a campaign
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="mt-10 space-y-4">
          {campaigns.map((c) => {
            const id = String(c._id);
            const subs = byCampaign.get(id) ?? [];
            const target = c.targetReviews ?? 0;
            const collected = c.collected ?? 0;
            const pct = target ? Math.min(100, Math.round((collected / target) * 100)) : 0;

            return (
              // <details> so a business with many campaigns isn't handed one
              // enormous scroll. Open by default — the submissions are the
              // point of the page, not something to go hunting for.
              <details
                key={id}
                open
                className="group rounded-card border border-default bg-surface-raised shadow-sm transition-colors duration-300 open:border-accent/30 [&_summary]:list-none"
              >
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-4 rounded-card p-5 transition-colors duration-200 hover:bg-surface-sunken/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="text-base font-bold text-primary">{c.name}</h2>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                          CAMPAIGN_STATUS_STYLES[c.status] ?? "pill-accent"
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                    <p className="nums mt-1 text-xs text-muted">
                      {PLATFORM_LABEL[c.platform] ?? c.platform} · {subs.length} submission
                      {subs.length === 1 ? "" : "s"} · {collected}/{target} verified
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Progress reads at a glance without opening the panel */}
                    <div className="hidden w-32 sm:block">
                      <div
                        className="h-2 overflow-hidden rounded-full bg-surface-sunken"
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${c.name} progress`}
                      >
                        <div
                          className="h-full rounded-full bg-accent transition-all duration-700 ease-out"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="nums mt-1 text-right text-[11px] font-semibold text-muted">{pct}%</p>
                    </div>
                    <ChevronDown
                      className="h-5 w-5 shrink-0 text-muted transition-transform duration-300 group-open:rotate-180"
                      aria-hidden="true"
                    />
                  </div>
                </summary>

                <div className="border-t border-default px-5 pb-5 pt-4">
                  {subs.length === 0 ? (
                    <p className="text-sm text-secondary">
                      No submissions for this campaign yet.
                      {c.targetUrl ? " Reviewers who join will appear here with their proof." : ""}
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {subs.map((s) => (
                        <li
                          key={String(s._id)}
                          className="rounded-btn border border-default bg-surface p-4 transition-colors duration-200 hover:border-strong"
                        >
                          <div className="flex flex-wrap items-start gap-4">
                            {/* Screenshot proof — opens full size in a new tab */}
                            <a
                              href={s.screenshotUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group/shot relative shrink-0 rounded-btn focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                            >
                              <Image
                                src={s.screenshotUrl}
                                alt={`Review proof from ${reviewerName.get(String(s.reviewer)) || "reviewer"}`}
                                width={80}
                                height={80}
                                className="h-20 w-20 rounded-btn border border-default object-cover transition-opacity duration-200 group-hover/shot:opacity-80"
                                unoptimized
                              />
                              <ExternalLink
                                className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded bg-surface/90 text-muted opacity-0 transition-opacity duration-200 group-hover/shot:opacity-100"
                                aria-hidden="true"
                              />
                            </a>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-primary">
                                    {reviewerName.get(String(s.reviewer)) || "Reviewer"}
                                  </p>
                                  <p className="text-xs text-muted">
                                    Submitted {new Date(s.createdAt).toLocaleDateString("en-IN")}
                                    {s.reviewedAt
                                      ? ` · reviewed ${new Date(s.reviewedAt).toLocaleDateString("en-IN")}`
                                      : ""}
                                  </p>
                                </div>
                                <span
                                  className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                                    STATUS_STYLES[s.status]
                                  }`}
                                >
                                  {s.status}
                                </span>
                              </div>

                              {s.note && (
                                <p className="mt-2 text-sm leading-relaxed text-secondary">{s.note}</p>
                              )}

                              {s.status === "rejected" && s.rejectionReason && (
                                <p className="mt-2 text-xs text-danger">
                                  Rejected: {s.rejectionReason}
                                </p>
                              )}

                              {s.status === "approved" && (
                                <p className="nums mt-2 text-xs font-semibold text-verified">
                                  Verified — counted towards this campaign
                                </p>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}

      <p className="mt-8 text-xs leading-relaxed text-muted">
        Reviewers are rewarded for verified participation, never for the rating they give. Ratings
        and review text are the reviewer&apos;s own and are never edited on their behalf.
      </p>
    </div>
  );
}
