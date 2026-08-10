"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Gavel, Inbox, MessageCircleWarning, RotateCcw, XCircle } from "lucide-react";
import ScreenshotViewer from "../shared/ScreenshotViewer";
import { toast } from "../../lib/toast";

const STATUS_STYLES = { approved: "pill-verified", pending: "pill-pending", rejected: "pill-danger" };
const STATUS_ICON = { approved: CheckCircle2, pending: Clock, rejected: XCircle };
const STATUS_ICON_BG = {
  approved: "bg-verified-subtle text-verified",
  pending: "bg-pending-subtle text-pending",
  rejected: "bg-danger-subtle text-danger",
};

const TABS = [
  { key: "all", label: "All" },
  { key: "approved", label: "Approved" },
  { key: "pending", label: "Pending" },
  { key: "rejected", label: "Rejected" },
];

function inr(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

/**
 * Appeal action for a rejected submission — a way to dispute the decision
 * itself ("the screenshot was right, please have a human look again"),
 * distinct from the "Resubmit with a new screenshot" link next to it (which
 * is for when there's genuinely new proof). Collapses to a status line once
 * an appeal has been filed; only one outstanding appeal is allowed at a
 * time — the API (api/reviewer/submissions/[id]/appeal) enforces that too.
 */
function AppealBox({ submissionId, appealStatus, appealMessage, appealResponse }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (message.trim().length < 10) {
      setError("Explain why in a bit more detail (at least 10 characters).");
      return;
    }
    setPending(true);
    setError("");
    const res = await fetch(`/api/reviewer/submissions/${submissionId}/appeal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: message.trim() }),
    });
    setPending(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.error ?? "Couldn't submit your appeal.";
      setError(msg);
      toast.error(msg);
      return;
    }
    toast.success("Appeal submitted — an admin will take another look.");
    setOpen(false);
    setMessage("");
    router.refresh();
  }

  if (appealStatus === "pending") {
    return (
      <div className="mt-2.5 flex items-start gap-1.5 rounded-btn border border-pending/40 bg-pending-subtle px-3 py-2 text-xs text-primary">
        <Gavel className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pending" aria-hidden="true" />
        <div>
          <p className="font-semibold">Appeal submitted — awaiting review.</p>
          {appealMessage && <p className="mt-0.5 text-muted">&ldquo;{appealMessage}&rdquo;</p>}
        </div>
      </div>
    );
  }

  if (appealStatus === "resolved") {
    return (
      <div className="mt-2.5 space-y-1.5">
        <div className="flex items-start gap-1.5 rounded-btn border border-default bg-surface px-3 py-2 text-xs text-secondary">
          <Gavel className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
          <div>
            <p className="font-semibold text-primary">Appeal reviewed — rejection upheld.</p>
            {appealResponse && <p className="mt-0.5">{appealResponse}</p>}
          </div>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
          >
            <MessageCircleWarning className="h-3 w-3" aria-hidden="true" />
            Appeal again
          </button>
        )}
        {open && (
          <AppealForm message={message} setMessage={setMessage} error={error} pending={pending} onCancel={() => { setOpen(false); setMessage(""); setError(""); }} onSubmit={submit} />
        )}
      </div>
    );
  }

  // appealStatus === "none"
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
      >
        <MessageCircleWarning className="h-3 w-3" aria-hidden="true" />
        Appeal this decision
      </button>
    );
  }

  return (
    <div className="mt-2.5">
      <AppealForm message={message} setMessage={setMessage} error={error} pending={pending} onCancel={() => { setOpen(false); setMessage(""); setError(""); }} onSubmit={submit} />
    </div>
  );
}

function AppealForm({ message, setMessage, error, pending, onCancel, onSubmit }) {
  return (
    <div className="animate-fade-up rounded-btn border border-default bg-surface p-3" style={{ animationDuration: "200ms" }}>
      <label className="mb-1 block text-xs font-semibold text-primary">Why should this be reconsidered?</label>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={2}
        maxLength={500}
        autoFocus
        placeholder="e.g. The screenshot does show my posted review — please take another look."
        className={`w-full rounded-btn border bg-surface-raised px-3 py-2 text-xs text-primary outline-none transition-all duration-200 focus:ring-2 focus:ring-accent/50 ${
          error ? "border-danger" : "border-default focus:border-accent"
        }`}
      />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={pending}
          className="rounded-btn bg-accent px-3 py-1.5 text-xs font-semibold text-on-brand shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {pending ? "Submitting…" : "Submit appeal"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-btn border border-default bg-surface-raised px-3 py-1.5 text-xs font-semibold text-secondary transition-colors duration-200 hover:bg-surface-sunken"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/**
 * Reviewer's own submission history — a status-filtered list (tabs match the
 * pattern used in the admin verification/withdrawal queues) instead of one
 * flat unfiltered list of everything ever submitted.
 */
export default function SubmissionHistory({ submissions }) {
  const [tab, setTab] = useState("all");

  const counts = {
    all: submissions.length,
    approved: submissions.filter((s) => s.status === "approved").length,
    pending: submissions.filter((s) => s.status === "pending").length,
    rejected: submissions.filter((s) => s.status === "rejected").length,
  };

  const visible = tab === "all" ? submissions : submissions.filter((s) => s.status === tab);

  return (
    <div className="mt-8">
      <div role="tablist" aria-label="Filter submissions by status" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {TABS.map((t) => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setTab(t.key)}
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                isActive
                  ? "border-transparent bg-accent text-on-brand shadow-sm"
                  : "border-default bg-surface text-secondary hover:-translate-y-0.5 hover:border-accent/40 hover:text-primary"
              }`}
            >
              {t.label}
              <span className={`nums rounded-full px-1.5 py-0.5 text-xs transition-colors duration-200 ${isActive ? "bg-white/20" : "bg-surface-sunken"}`}>
                {counts[t.key]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {visible.length === 0 ? (
          <div className="animate-fade-up rounded-card border border-dashed border-default bg-surface-raised p-10 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-sunken">
              <Inbox className="h-6 w-6 text-muted" aria-hidden="true" />
            </span>
            <p className="mt-3 text-sm font-semibold text-primary">
              {tab === "all" ? "No submissions yet" : "Nothing here yet"}
            </p>
            <p className="mt-1 text-sm text-secondary">
              {tab === "all" ? (
                <>Join a campaign from the <Link href="/reviewer/campaigns" className="font-semibold text-accent hover:underline">available campaigns</Link> page.</>
              ) : (
                "Submissions will show up here once there are some in this status."
              )}
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {visible.map((s, i) => {
              const StatusIcon = STATUS_ICON[s.status] ?? Clock;
              return (
                <li
                  key={s.id}
                  style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                  className="animate-fade-up rounded-card border border-default bg-surface-raised p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-md"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <ScreenshotViewer url={s.screenshotUrl} alt="Review screenshot" size={64} />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-primary">{s.campaignName}</p>
                          <span className={`flex h-5 w-5 items-center justify-center rounded-full ${STATUS_ICON_BG[s.status] ?? "bg-surface-sunken text-muted"}`}>
                            <StatusIcon className="h-3 w-3" aria-hidden="true" />
                          </span>
                        </div>
                        <p className="text-xs capitalize text-muted">
                          {s.platform} · {new Date(s.createdAt).toLocaleDateString("en-IN")}
                        </p>
                        {s.note && <p className="mt-1.5 text-sm text-secondary">{s.note}</p>}
                        {s.status === "rejected" && s.rejectionReason && (
                          <p className="mt-1.5 text-xs text-danger">Reason: {s.rejectionReason}</p>
                        )}
                        {s.status === "rejected" && (
                          <Link
                            href="/reviewer/campaigns"
                            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                          >
                            <RotateCcw className="h-3 w-3" aria-hidden="true" />
                            Resubmit with a new screenshot
                          </Link>
                        )}
                        {s.status === "rejected" && (
                          <AppealBox
                            submissionId={s.id}
                            appealStatus={s.appealStatus}
                            appealMessage={s.appealMessage}
                            appealResponse={s.appealResponse}
                          />
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[s.status]}`}>
                        {s.status}
                      </span>
                      {s.status === "approved" && (
                        <p className="nums mt-1.5 text-sm font-bold text-verified">+{inr(s.rewardAmount)}</p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
