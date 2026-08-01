"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, ExternalLink } from "lucide-react";

/**
 * Admin review-verification queue. Approve credits the reviewer; reject asks for
 * a reason. Both call PATCH /api/admin/submissions/[id].
 */
export default function VerificationQueue({ submissions, reward }) {
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState("");

  async function act(id, action, reasonText = "") {
    setBusy(id);
    const res = await fetch(`/api/admin/submissions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason: reasonText }),
    });
    setBusy(null);
    setRejecting(null);
    setReason("");
    if (res.ok) router.refresh();
  }

  if (submissions.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-default bg-surface-raised p-10 text-center">
        <p className="text-sm text-secondary">No submissions waiting for verification. 🎉</p>
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {submissions.map((s) => (
        <li key={s.id} className="rounded-card border border-default bg-surface-raised p-5 shadow-sm">
          <div className="flex flex-wrap gap-5">
            <a href={s.screenshotUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
              <Image src={s.screenshotUrl} alt="Screenshot proof" width={112} height={112}
                className="h-28 w-28 rounded-btn border border-default object-cover" unoptimized />
            </a>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-primary">{s.campaignName}</p>
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

              {rejecting === s.id ? (
                <div className="mt-4">
                  <input value={reason} onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason for rejection…"
                    className="w-full rounded-btn border border-default bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/50" />
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => act(s.id, "reject", reason)} disabled={busy === s.id}
                      className="rounded-btn bg-danger px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60">
                      Confirm reject
                    </button>
                    <button type="button" onClick={() => { setRejecting(null); setReason(""); }}
                      className="rounded-btn border border-default bg-surface px-3 py-1.5 text-sm font-semibold text-secondary">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => act(s.id, "approve")} disabled={busy === s.id}
                    className="inline-flex items-center gap-1.5 rounded-btn bg-verified px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60">
                    <Check className="h-4 w-4" aria-hidden="true" />
                    Approve & pay ₹{reward}
                  </button>
                  <button type="button" onClick={() => setRejecting(s.id)} disabled={busy === s.id}
                    className="inline-flex items-center gap-1.5 rounded-btn border border-default bg-surface px-4 py-2 text-sm font-semibold text-danger transition hover:bg-danger-subtle disabled:opacity-60">
                    <X className="h-4 w-4" aria-hidden="true" />
                    Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
