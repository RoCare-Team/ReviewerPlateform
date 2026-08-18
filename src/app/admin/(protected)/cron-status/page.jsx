import { requireAdmin } from "../../../../lib/auth/guards";
import { getCronStatus } from "../../../../lib/cronStatus";
import { CheckCircle2, Clock, AlertTriangle, HelpCircle, RefreshCcw } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Cron status · Admin", robots: { index: false } };
// Always hit the DB fresh — this page exists specifically to answer
// "is it running right now", so a cached/stale render would defeat the point.
export const dynamic = "force-dynamic";

const JOB_LABELS = {
  "gmb-recheck": "GMB recheck",
  "gmb-auto-reply": "GMB auto-reply",
};
const JOB_DESCRIPTIONS = {
  "gmb-recheck": "Retries the Google match for pending, AI-approved submissions until Google's own listing catches up.",
  "gmb-auto-reply": "Drafts and posts AI replies to newly synced Google reviews.",
};
// Turns each job's raw `lastResult` into a short, plain-English line instead
// of dumping JSON at an admin who isn't reading this to debug the shape of
// the response.
const RESULT_SUMMARY = {
  "gmb-recheck": (r) =>
    r ? `Checked ${r.checked ?? 0} submission${r.checked === 1 ? "" : "s"}, approved ${r.approved ?? 0}.` : null,
  "gmb-auto-reply": (r) =>
    r
      ? `Checked ${r.connectionsChecked ?? 0} connection${r.connectionsChecked === 1 ? "" : "s"}, posted ${r.repliesPosted ?? 0} repl${r.repliesPosted === 1 ? "y" : "ies"}${r.skipped ? `, skipped ${r.skipped}` : ""}.`
      : null,
};

// Status colors follow the same tokens used across the rest of the panel
// (verified/danger/pending — see the reviewer "Live" badge, submission verdict
// panel, etc.) so this page reads as part of the same product, not a bolted-on
// debug tool. Only the neutral chrome (refresh button, progress track) uses
// the brand accent.
const STATUS_STYLE = {
  healthy: {
    label: "Running",
    Icon: CheckCircle2,
    pill: "border-verified bg-verified-subtle text-verified",
    bar: "bg-verified",
  },
  erroring: {
    label: "Running, but erroring",
    Icon: AlertTriangle,
    pill: "border-danger bg-danger-subtle text-danger",
    bar: "bg-danger",
  },
  down: {
    label: "Down — not being called",
    Icon: AlertTriangle,
    pill: "border-danger bg-danger-subtle text-danger",
    bar: "bg-danger",
  },
  never_run: {
    label: "Never run yet",
    Icon: HelpCircle,
    pill: "border-pending bg-pending-subtle text-primary",
    bar: "bg-pending",
  },
};

function timeAgo(minutes) {
  if (minutes == null) return "—";
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m ago`;
}

export default async function AdminCronStatusPage() {
  await requireAdmin();
  const jobs = await getCronStatus();

  const downCount = jobs.filter((j) => j.status === "down" || j.status === "erroring").length;
  const allHealthy = downCount === 0 && jobs.every((j) => j.status === "healthy");

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Cron status</h1>
          <p className="mt-2 max-w-2xl text-secondary">
            Whether Vercel is actually calling each scheduled job on time. A job only turns{" "}
            <strong className="text-primary">Down</strong> after missing several ticks in a row, so one slow run
            doesn&apos;t cry wolf.
          </p>
        </div>
        <Link
          href="/admin/cron-status"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-btn border border-accent/40 bg-accent-subtle px-3 py-2 text-sm font-semibold text-accent shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent hover:text-on-brand hover:shadow-md"
        >
          <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Refresh
        </Link>
      </div>

      {/* One-glance summary banner — the answer to "is everything OK" without
          reading every card below. */}
      <div
        className={`mt-6 flex items-center gap-3 rounded-card border p-4 ${
          allHealthy ? "border-verified bg-verified-subtle text-verified" : "border-danger bg-danger-subtle text-danger"
        }`}
      >
        {allHealthy ? (
          <CheckCircle2 className="h-6 w-6 shrink-0" aria-hidden="true" />
        ) : (
          <AlertTriangle className="h-6 w-6 shrink-0" aria-hidden="true" />
        )}
        <p className="text-sm font-bold">
          {allHealthy
            ? "All cron jobs are running on schedule."
            : `${downCount} of ${jobs.length} cron job${downCount === 1 ? "" : "s"} need${downCount === 1 ? "s" : ""} attention.`}
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:max-w-3xl">
        {jobs.map((j) => {
          const tone = STATUS_STYLE[j.status] ?? STATUS_STYLE.never_run;
          const summary = RESULT_SUMMARY[j.job]?.(j.lastResult);
          // Visual "how close to overdue" bar — fills up as the last run ages
          // toward the 3-missed-ticks threshold that flips this to Down.
          const overdueAtMinutes = j.expectedEveryMinutes * 3;
          const fillPct =
            j.minutesSinceLastRun == null ? 0 : Math.min(100, Math.round((j.minutesSinceLastRun / overdueAtMinutes) * 100));

          return (
            <div key={j.job} className="rounded-card border border-default bg-surface-raised p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-subtle text-accent">
                    <Clock className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-base font-bold text-primary">{JOB_LABELS[j.job] ?? j.job}</p>
                    <p className="mt-0.5 text-sm text-secondary">{JOB_DESCRIPTIONS[j.job] ?? ""}</p>
                  </div>
                </div>
                <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${tone.pill}`}>
                  <tone.Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {tone.label}
                </span>
              </div>

              {/* Last run + how far along toward "overdue" it is */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs font-medium text-secondary">
                  <span>Last ran {timeAgo(j.minutesSinceLastRun)}</span>
                  <span className="text-muted">runs every ~{j.expectedEveryMinutes} min</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-sunken">
                  <div className={`h-full rounded-full transition-all duration-700 ease-out ${tone.bar}`} style={{ width: `${fillPct}%` }} />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                <p>
                  <span className="text-muted">Total runs: </span>
                  <span className="nums font-semibold text-primary">{j.runCount}</span>
                </p>
                {summary && <p className="text-secondary">{summary}</p>}
              </div>

              {j.lastError && (
                <p className="mt-3 rounded-btn border border-danger bg-danger-subtle px-3 py-2 text-xs text-danger">
                  Last error: {j.lastError}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
