import Link from "next/link";
import {
  Building2,
  Users,
  UserRound,
  Megaphone,
  PlayCircle,
  CheckCircle2,
  Clock,
  ThumbsUp,
  ThumbsDown,
  FileCheck2,
  Star,
  Wallet,
  ArrowRight,
} from "lucide-react";
import { requireAdmin } from "../../../lib/auth/guards";
import dbConnect from "../../../lib/db";
import User from "../../../models/User";
import Campaign from "../../../models/Campaign";
import Submission from "../../../models/Submission";
import GmbReview from "../../../models/GmbReview";
import WalletTransaction from "../../../models/WalletTransaction";
import { inr } from "../../../lib/settings";

export const metadata = { title: "Admin · ReviewHub", robots: { index: false } };

function StatCard({ label, value, Icon, tone = "text-accent", sub }) {
  return (
    <div className="rounded-card border border-default bg-surface-raised p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm text-secondary">{label}</span>
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg bg-surface-sunken ${tone}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-extrabold tracking-tight text-primary">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{title}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  );
}

export default async function AdminOverviewPage() {
  const user = await requireAdmin();

  await dbConnect();

  const [
    businesses,
    reviewers,
    admins,
    campaignsTotal,
    campaignsActive,
    campaignsCompleted,
    campaignsPaused,
    subsTotal,
    subsPending,
    subsApproved,
    subsRejected,
    reviewsFetched,
    rewardAgg,
    collectedAgg,
  ] = await Promise.all([
    User.countDocuments({ role: "business_owner" }),
    User.countDocuments({ role: "reviewer" }),
    User.countDocuments({ role: "admin" }),
    Campaign.countDocuments({}),
    Campaign.countDocuments({ status: "active" }),
    Campaign.countDocuments({ status: "completed" }),
    Campaign.countDocuments({ status: { $in: ["paused", "draft"] } }),
    Submission.countDocuments({}),
    Submission.countDocuments({ status: "pending" }),
    Submission.countDocuments({ status: "approved" }),
    Submission.countDocuments({ status: "rejected" }),
    GmbReview.countDocuments({}),
    WalletTransaction.aggregate([{ $match: { type: "reward" } }, { $group: { _id: null, sum: { $sum: "$amount" } } }]),
    Campaign.aggregate([{ $group: { _id: null, collected: { $sum: "$collected" }, target: { $sum: "$targetReviews" } } }]),
  ]);

  const rewardsPaid = rewardAgg[0]?.sum ?? 0;
  const totalCollected = collectedAgg[0]?.collected ?? 0;
  const totalTarget = collectedAgg[0]?.target ?? 0;
  const totalUsers = businesses + reviewers + admins;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Administration</h1>
          <p className="mt-2 text-secondary">Signed in as {user.email}.</p>
        </div>
        {subsPending > 0 && (
          <Link
            href="/admin/verification"
            className="inline-flex items-center gap-2 rounded-btn bg-accent px-4 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition hover:bg-accent-hover"
          >
            <FileCheck2 className="h-4 w-4" aria-hidden="true" />
            {subsPending} pending verification{subsPending > 1 ? "s" : ""}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </div>

      <Section title="People">
        <StatCard label="Businesses" value={businesses} Icon={Building2} />
        <StatCard label="Reviewers" value={reviewers} Icon={UserRound} tone="text-verified" />
        <StatCard label="Admins" value={admins} Icon={Users} tone="text-pending" />
        <StatCard label="Total users" value={totalUsers} Icon={Users} />
      </Section>

      <Section title="Campaigns">
        <StatCard label="Total campaigns" value={campaignsTotal} Icon={Megaphone} />
        <StatCard label="Active" value={campaignsActive} Icon={PlayCircle} tone="text-verified" />
        <StatCard label="Completed" value={campaignsCompleted} Icon={CheckCircle2} tone="text-accent" />
        <StatCard label="Paused / draft" value={campaignsPaused} Icon={Clock} tone="text-pending" />
      </Section>

      <Section title="Reviews & verification">
        <StatCard label="Submissions" value={subsTotal} Icon={FileCheck2} sub={`${totalCollected}/${totalTarget} target collected`} />
        <StatCard label="Pending" value={subsPending} Icon={Clock} tone="text-pending" />
        <StatCard label="Approved" value={subsApproved} Icon={ThumbsUp} tone="text-verified" />
        <StatCard label="Rejected" value={subsRejected} Icon={ThumbsDown} tone="text-danger" />
      </Section>

      <Section title="Platform">
        <StatCard label="Google reviews fetched" value={reviewsFetched} Icon={Star} />
        <StatCard label="Rewards paid to reviewers" value={inr(rewardsPaid)} Icon={Wallet} tone="text-verified" />
      </Section>

      <p className="mt-8 rounded-card border border-default bg-surface-sunken p-4 text-sm text-secondary">
        Admin sessions last 8 hours, not 30 days like user sessions. You&apos;ll be asked to sign in
        again after that.
      </p>
    </div>
  );
}
