"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Check, ExternalLink, Inbox, ShieldCheck, ShieldOff, X } from "lucide-react";
import ScreenshotViewer from "../shared/ScreenshotViewer";
import { toast } from "../../lib/toast";

const STATUS_STYLES = {
  approved: "pill-verified",
  pending: "pill-pending",
  rejected: "pill-danger",
};

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

/**
 * Admin review-verification queue. Tabs default to "Pending" — the ones still
 * needing a human decision — but "Approved"/"Rejected"/"All" surface every
 * decided submission too. Approve/Reject render for pending items; a
 * REJECTED submission additionally gets an "Approve anyway" override (admin
 * only — see the API route) so a call reversed later doesn't need a whole new
 * submission. An APPROVED submission (whether the AI or an admin verified it)
 * can be "Unverified" — claws back the reviewer's reward and flips it to
 * rejected — for when a verdict (AI or human) turns out to be wrong.
 */
export default function VerificationQueue({ submissions, reward, initialTab = "pending" }) {
  const router = useRouter();
  const [tab, setTab] = useState(initialTab);
  const [busy, setBusy] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState("");
  const [overriding, setOverriding] = useState(null);
  const [unverifying, setUnverifying] = useState(null);
  const [unverifyReason, setUnverifyReason] = useState("");
  const [unverifyError, setUnverifyError] = useState("");

  const counts = {
    pending: submissions.filter((s) => s.status === "pending").length,
    approved: submissions.filter((s) => s.status === "approved").length,
    rejected: submissions.filter((s) => s.status === "rejected").length,
    all: submissions.length,
  };

  const visible = tab === "all" ? submissions : submissions.filter((s) => s.status === tab);

  const [reasonError, setReasonError] = useState("");

  async function act(id, action, reasonText = "") {
    // A rejection/unverify must say WHY — the reviewer sees this reason.
    if (action === "reject" && !reasonText.trim()) {
      setReasonError("Please enter a reason for rejection.");
      return;
    }
    if (action === "unverify" && !reasonText.trim()) {
      setUnverifyError("Please enter a reason for un-verifying.");
      return;
    }
    setReasonError("");
    setUnverifyError("");
    setBusy(id);
    const res = await fetch(`/api/admin/submissions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason: reasonText.trim() }),
    });
    setBusy(null);
    setRejecting(null);
    setReason("");
    setOverriding(null);
    setUnverifying(null);
    setUnverifyReason("");

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Couldn't update the submission.");
      return;
    }

    const data = await res.json().catch(() => ({}));
    if (data.warning) {
      toast.error(data.warning);
    } else {
      toast.success(
        action === "approve" ? "Submission approved." : action === "unverify" ? "Submission un-verified." : "Submission rejected."
      );
    }
    router.refresh();
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Filter submissions by status"
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
      >
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
          <div className="animate-fade-up rounded-card border border-dashed border-default bg-surface-raised p-12 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-verified-subtle">
              <Inbox className="h-6 w-6 text-verified" aria-hidden="true" />
            </span>
            <p className="mt-4 text-sm font-semibold text-primary">
              {tab === "pending" ? "All caught up" : "Nothing here yet"}
            </p>
            <p className="mt-1 text-sm text-secondary">
              {tab === "pending"
                ? "No submissions waiting for verification right now."
                : "Submissions will show up here once there are some in this status."}
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {visible.map((s, i) => (
              <li
                key={s.id}
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                className="animate-fade-up rounded-card border border-default bg-surface-raised p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-md"
              >
                <div className="flex flex-wrap gap-5">
                  <ScreenshotViewer url={s.screenshotUrl} alt="Screenshot proof" size={112} />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-primary">{s.campaignName}</p>
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${STATUS_STYLES[s.status] ?? "pill-accent"}`}>
                            {s.status}
                          </span>
                          {s.verifiedBy === "ai" && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full bg-accent-subtle px-2 py-0.5 text-[11px] font-semibold text-accent"
                              title={s.aiReason || "Decided automatically by AI"}
                            >
                              <Bot className="h-3 w-3" aria-hidden="true" />
                              AI · {Math.round((s.aiConfidence || 0) * 100)}%
                            </span>
                          )}
                          {s.verifiedBy === "admin" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-semibold text-secondary">
                              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                              {s.reviewedByName ? `Admin · ${s.reviewedByName}` : "Admin"}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted capitalize">
                          {s.platform} · by {s.reviewerName || s.reviewerEmail} · {s.date}
                        </p>
                      </div>
                      {s.targetUrl && (
                        <a href={s.targetUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
                          Review link <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      )}
                    </div>
                    {s.note && <p className="mt-2 text-sm text-secondary">{s.note}</p>}

                    {s.aiReason && (
                      <p className="mt-2 text-xs text-muted">AI note: {s.aiReason}</p>
                    )}

                    {s.status === "rejected" && s.rejectionReason && (
                      <p className="mt-2 text-xs text-danger">Rejected: {s.rejectionReason}</p>
                    )}
                    {s.status === "approved" && (
                      <p className="nums mt-2 text-xs font-semibold text-verified">
                        Verified{s.reviewedDate ? ` · ${s.reviewedDate}` : ""} — reviewer paid ₹{reward}
                      </p>
                    )}

                    {s.status === "approved" && (
                      unverifying === s.id ? (
                        <div className="mt-4 animate-fade-up" style={{ animationDuration: "200ms" }}>
                          <label className="mb-1 block text-xs font-semibold text-primary">
                            Reason for un-verifying <span className="text-danger">*</span>
                          </label>
                          <input
                            value={unverifyReason}
                            onChange={(e) => { setUnverifyReason(e.target.value); setUnverifyError(""); }}
                            placeholder="e.g. AI verdict was wrong — screenshot doesn't hold up"
                            autoFocus
                            className={`w-full rounded-btn border bg-surface px-3 py-2 text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-accent/50 ${unverifyError ? "border-danger" : "border-default focus:border-accent"}`}
                          />
                          {unverifyError && <p className="mt-1 text-xs text-danger">{unverifyError}</p>}
                          <p className="mt-1 text-xs text-muted">
                            Reverses the reward from the reviewer&apos;s wallet and reopens the campaign slot. The reviewer will see this reason.
                          </p>
                          <div className="mt-2 flex gap-2">
                            <button type="button" onClick={() => act(s.id, "unverify", unverifyReason)} disabled={busy === s.id || !unverifyReason.trim()}
                              className="rounded-btn bg-danger px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60 disabled:hover:translate-y-0">
                              {busy === s.id ? "Working…" : "Confirm un-verify"}
                            </button>
                            <button type="button" onClick={() => { setUnverifying(null); setUnverifyReason(""); setUnverifyError(""); }}
                              className="rounded-btn border border-default bg-surface px-3 py-1.5 text-sm font-semibold text-secondary transition-colors duration-200 hover:bg-surface-sunken">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setUnverifying(s.id)}
                          title="Reverse this approval — claws back the reward"
                          className="mt-4 inline-flex items-center gap-1.5 rounded-btn border border-danger/40 bg-surface px-3.5 py-2 text-sm font-semibold text-danger transition-all duration-200 hover:-translate-y-0.5 hover:bg-danger-subtle hover:shadow-sm"
                        >
                          <ShieldOff className="h-4 w-4" aria-hidden="true" />
                          Unverify
                        </button>
                      )
                    )}

                    {s.status === "pending" && (
                      rejecting === s.id ? (
                        <div className="mt-4 animate-fade-up" style={{ animationDuration: "200ms" }}>
                          <label className="mb-1 block text-xs font-semibold text-primary">
                            Reason for rejection <span className="text-danger">*</span>
                          </label>
                          <input value={reason} onChange={(e) => { setReason(e.target.value); setReasonError(""); }}
                            placeholder="e.g. Screenshot doesn't show a posted review"
                            autoFocus
                            className={`w-full rounded-btn border bg-surface px-3 py-2 text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-accent/50 ${reasonError ? "border-danger" : "border-default focus:border-accent"}`} />
                          {reasonError && <p className="mt-1 text-xs text-danger">{reasonError}</p>}
                          <p className="mt-1 text-xs text-muted">The reviewer will see this reason.</p>
                          <div className="mt-2 flex gap-2">
                            <button type="button" onClick={() => act(s.id, "reject", reason)} disabled={busy === s.id || !reason.trim()}
                              className="rounded-btn bg-danger px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60 disabled:hover:translate-y-0">
                              Confirm reject
                            </button>
                            <button type="button" onClick={() => { setRejecting(null); setReason(""); setReasonError(""); }}
                              className="rounded-btn border border-default bg-surface px-3 py-1.5 text-sm font-semibold text-secondary transition-colors duration-200 hover:bg-surface-sunken">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button type="button" onClick={() => act(s.id, "approve")} disabled={busy === s.id}
                            className="inline-flex items-center gap-1.5 rounded-btn bg-verified px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60 disabled:hover:translate-y-0">
                            <Check className="h-4 w-4" aria-hidden="true" />
                            {busy === s.id ? "Working…" : `Approve & pay ₹${reward}`}
                          </button>
                          <button type="button" onClick={() => setRejecting(s.id)} disabled={busy === s.id}
                            className="inline-flex items-center gap-1.5 rounded-btn border border-default bg-surface px-4 py-2 text-sm font-semibold text-danger transition-all duration-200 hover:-translate-y-0.5 hover:bg-danger-subtle hover:shadow-md disabled:opacity-60 disabled:hover:translate-y-0">
                            <X className="h-4 w-4" aria-hidden="true" />
                            Reject
                          </button>
                        </div>
                      )
                    )}

                    {s.status === "rejected" && (
                      overriding === s.id ? (
                        <div className="mt-4 animate-fade-up rounded-btn border border-verified bg-verified-subtle p-3" style={{ animationDuration: "200ms" }}>
                          <p className="text-sm text-primary">
                            Approve this rejected submission anyway and pay the reviewer <span className="font-bold">₹{reward}</span>?
                          </p>
                          <div className="mt-2 flex gap-2">
                            <button type="button" onClick={() => act(s.id, "approve")} disabled={busy === s.id}
                              className="rounded-btn bg-verified px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60 disabled:hover:translate-y-0">
                              {busy === s.id ? "Working…" : "Yes, approve & pay"}
                            </button>
                            <button type="button" onClick={() => setOverriding(null)} disabled={busy === s.id}
                              className="rounded-btn border border-default bg-surface px-3 py-1.5 text-sm font-semibold text-secondary transition-colors duration-200 hover:bg-surface-sunken">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setOverriding(s.id)}
                          title="Only an admin can override a rejection"
                          className="mt-4 inline-flex items-center gap-1.5 rounded-btn border border-verified/40 bg-surface px-3.5 py-2 text-sm font-semibold text-verified transition-all duration-200 hover:-translate-y-0.5 hover:bg-verified-subtle hover:shadow-sm"
                        >
                          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                          Approve anyway
                        </button>
                      )
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
