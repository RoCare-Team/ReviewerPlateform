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
import DonutChart from "../../../components/charts/DonutChart";
import StatCard from "../../../components/shared/StatCard";

export const metadata = { title: "Admin · RapportLook", robots: { index: false } };

function Section({ title, children, first = false }) {
  return (
    <section className={first ? "" : "mt-8"}>
      <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{title}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  );
}

function ChartCard({ title, Icon, children }) {
  return (
    <div className="rounded-card border border-default bg-surface-raised p-6 shadow-sm transition-all duration-300 hover:shadow-md">
      <h3 className="flex items-center gap-2 text-sm font-bold text-primary">
        <Icon className="h-4 w-4 text-accent" aria-hidden="true" />
        {title}
      </h3>
      <div className="mt-5">{children}</div>
    </div>
  );
}

export default async function AdminOverviewPage() {
  await requireAdmin();

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
      {/* Only takes up space when there's actually something pending — an
          empty wrapper here (even with no visible content) was adding a
          blank beat above "People" on every load. */}
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

      <Section title="People" first={subsPending === 0}>
        <StatCard label="Businesses" value={businesses} Icon={Building2} href="/admin/organisations" />
        <StatCard label="Reviewers" value={reviewers} Icon={UserRound} tone="text-verified" href="/admin/users?role=reviewer" />
        <StatCard label="Admins" value={admins} Icon={Users} tone="text-pending" href="/admin/users?role=admin" />
        <StatCard label="Total users" value={totalUsers} Icon={Users} href="/admin/users" />
      </Section>

      <Section title="Campaigns">
        <StatCard label="Total campaigns" value={campaignsTotal} Icon={Megaphone} href="/admin/campaigns" />
        <StatCard label="Active" value={campaignsActive} Icon={PlayCircle} tone="text-verified" href="/admin/campaigns?status=active" />
        <StatCard label="Completed" value={campaignsCompleted} Icon={CheckCircle2} tone="text-accent" href="/admin/campaigns?status=completed" />
        <StatCard label="Paused / draft" value={campaignsPaused} Icon={Clock} tone="text-pending" href="/admin/campaigns?status=paused" />
      </Section>

      <Section title="Reviews & verification">
        <StatCard label="Submissions" value={subsTotal} Icon={FileCheck2} sub={`${totalCollected}/${totalTarget} target collected`} href="/admin/verification?tab=all" />
        <StatCard label="Pending" value={subsPending} Icon={Clock} tone="text-pending" href="/admin/verification" />
        <StatCard label="Approved" value={subsApproved} Icon={ThumbsUp} tone="text-verified" href="/admin/verification?tab=approved" />
        <StatCard label="Rejected" value={subsRejected} Icon={ThumbsDown} tone="text-danger" href="/admin/verification?tab=rejected" />
      </Section>

      <Section title="Platform">
        <StatCard label="Google reviews fetched" value={reviewsFetched} Icon={Star} href="/admin/organisations" />
        <StatCard label="Rewards paid to reviewers" value={inr(rewardsPaid)} Icon={Wallet} tone="text-verified" href="/admin/users?role=reviewer" />
      </Section>

      <section className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">At a glance</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <ChartCard title="People" Icon={Users}>
            <DonutChart
              centerLabel="users"
              segments={[
                { label: "Businesses", value: businesses, color: "var(--accent)" },
                { label: "Reviewers", value: reviewers, color: "var(--verified)" },
                { label: "Admins", value: admins, color: "var(--pending)" },
              ]}
            />
          </ChartCard>

          <ChartCard title="Campaign status" Icon={Megaphone}>
            <DonutChart
              centerLabel="campaigns"
              segments={[
                { label: "Active", value: campaignsActive, color: "var(--verified)" },
                { label: "Completed", value: campaignsCompleted, color: "var(--accent)" },
                { label: "Paused / draft", value: campaignsPaused, color: "var(--pending)" },
              ]}
            />
          </ChartCard>

          <ChartCard title="Submission status" Icon={FileCheck2}>
            <DonutChart
              centerLabel="submissions"
              segments={[
                { label: "Approved", value: subsApproved, color: "var(--verified)" },
                { label: "Pending", value: subsPending, color: "var(--pending)" },
                { label: "Rejected", value: subsRejected, color: "var(--danger)" },
              ]}
            />
          </ChartCard>
        </div>
      </section>
    </div>
  );
}
