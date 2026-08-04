"use client";

import { Wallet, CheckCircle2, Clock, XCircle, FileCheck2 } from "lucide-react";
import DonutChart from "../charts/DonutChart";
import StatCard from "../shared/StatCard";

export default function OverviewStats({ walletBalance, approved, pending, rejected, formattedWallet }) {
  const total = approved + pending + rejected;
  const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;

  const STATS = [
    { label: "Wallet balance", value: formattedWallet, Icon: Wallet, tone: "text-accent" },
    { label: "Approved reviews", value: String(approved), Icon: CheckCircle2, tone: "text-verified", href: "/reviewer/feedback" },
    { label: "Pending reviews", value: String(pending), Icon: Clock, tone: "text-pending", href: "/reviewer/feedback" },
    { label: "Rejected", value: String(rejected), Icon: XCircle, tone: "text-danger", href: "/reviewer/feedback" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      <div className="rounded-card border border-default bg-surface-raised p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-bold text-primary">
            <FileCheck2 className="h-4.5 w-4.5 text-accent" aria-hidden="true" />
            Submission overview
          </h2>
          {total > 0 && (
            <span className="pill-verified rounded-full px-2.5 py-1 text-xs font-semibold">
              {approvalRate}% approval rate
            </span>
          )}
        </div>

        <div className="mt-6">
          {total === 0 ? (
            <p className="text-sm text-secondary">
              No submissions yet — pick a campaign below to get started.
            </p>
          ) : (
            <DonutChart
              centerLabel="submissions"
              segments={[
                { label: "Approved", value: approved, color: "var(--verified)" },
                { label: "Pending", value: pending, color: "var(--pending)" },
                { label: "Rejected", value: rejected, color: "var(--danger)" },
              ]}
            />
          )}
        </div>
      </div>
    </div>
  );
}
