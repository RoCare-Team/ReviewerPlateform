"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, ExternalLink, Megaphone, RotateCcw, Upload, Star, X, XCircle } from "lucide-react";
import { toast } from "../../lib/toast";

/**
 * Available-campaign cards for reviewers. Each card lets the reviewer open the
 * review URL, upload a screenshot proof, and submit — which posts multipart to
 * /api/reviewer/submissions (status pending until admin verifies).
 */
function inr(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

function Card({ campaign, reward }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!file) {
      setError("Upload a screenshot of your review.");
      toast.error("Upload a screenshot of your review.");
      return;
    }

    const fd = new FormData();
    fd.append("campaignId", campaign.id);
    fd.append("note", note);
    fd.append("screenshot", file);

    setPending(true);
    const res = await fetch("/api/reviewer/submissions", { method: "POST", body: fd });
    setPending(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data.error ?? "Submission failed.";
      setError(message);
      toast.error(message);
      return;
    }

    // AI decided instantly — show the outcome; refresh on dismiss.
    if (data.status === "approved") toast.success(`Verified! +${inr(data.reward)} credited.`);
    else if (data.status === "rejected") toast.error("Submission not verified.");
    else toast("Submitted — pending review.", { icon: "⏳" });

    setResult({ status: data.status, reward: data.reward, reason: data.reason });
    setOpen(false);
  }

  // AI verdict panel — replaces the card once a submission is decided. Clear,
  // unambiguous outcome: a big status icon + headline, the reward called out
  // on its own line (not buried in a sentence), and the AI's reason underneath.
  if (result) {
    const approved = result.status === "approved";
    const rejected = result.status === "rejected";
    const tone = approved
      ? { Icon: CheckCircle2, iconBg: "bg-verified-subtle text-verified", box: "border-verified bg-verified-subtle text-verified", headline: "Verified!" }
      : rejected
        ? { Icon: XCircle, iconBg: "bg-danger-subtle text-danger", box: "border-danger bg-danger-subtle text-danger", headline: "Not verified" }
        : { Icon: Clock, iconBg: "bg-pending-subtle text-pending", box: "border-pending bg-pending-subtle text-primary", headline: "Submitted for review" };

    return (
      <div className="animate-fade-up flex h-full flex-col items-center rounded-card border border-default bg-surface-raised p-6 text-center shadow-sm" style={{ animationDuration: "250ms" }}>
        <span className={`flex h-14 w-14 items-center justify-center rounded-full ${tone.iconBg}`}>
          <tone.Icon className="h-7 w-7" aria-hidden="true" />
        </span>
        <h3 className="mt-3 text-base font-bold text-primary">{campaign.name}</h3>
        <p className="mt-1 text-lg font-extrabold text-primary">{tone.headline}</p>

        {approved && (
          <p className="nums mt-1 text-2xl font-extrabold text-verified">+{inr(result.reward)}</p>
        )}

        {result.reason && (
          <div className={`mt-4 w-full rounded-btn border px-4 py-3 text-left text-sm ${tone.box}`}>
            {result.reason}
          </div>
        )}

        <button
          type="button"
          onClick={() => router.refresh()}
          className={`mt-5 inline-flex items-center gap-2 rounded-btn px-5 py-2.5 text-sm font-semibold shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
            rejected ? "bg-danger text-white hover:opacity-90" : "bg-accent text-on-brand hover:bg-accent-hover"
          }`}
        >
          {rejected ? (
            <>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Try again
            </>
          ) : (
            "Done"
          )}
        </button>
      </div>
    );
  }

  const pct = campaign.target ? Math.min(100, Math.round((campaign.collected / campaign.target) * 100)) : 0;

  return (
    <div className="group flex h-full flex-col rounded-card border border-default bg-surface-raised p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-accent/30 hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-subtle text-accent transition-transform duration-300 group-hover:scale-110">
            <Megaphone className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold text-primary">{campaign.name}</h3>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-xs font-medium capitalize text-muted">{campaign.platform}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-verified-subtle px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-verified">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-verified opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-verified" />
                </span>
                Live
              </span>
            </div>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-verified-subtle px-2.5 py-1 text-xs font-bold text-verified">
          <Star className="h-3.5 w-3.5 fill-verified text-verified" aria-hidden="true" />
          Earn {inr(reward)}
        </span>
      </div>

      {campaign.previouslyRejected && (
        <p className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-danger-subtle px-2.5 py-1 text-xs font-semibold text-danger">
          <RotateCcw className="h-3 w-3" aria-hidden="true" />
          Previously rejected — try again with a new screenshot
        </p>
      )}

      {campaign.notes && <p className="mt-3 text-sm leading-relaxed text-secondary">{campaign.notes}</p>}

      {/* Live progress — spots left toward the campaign target */}
      {typeof campaign.target === "number" && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs font-medium text-secondary">
            <span className="nums">{campaign.collected} / {campaign.target} collected</span>
            <span className="nums font-bold text-accent">{campaign.remaining} spots left</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-sunken">
            <div
              className="h-full rounded-full bg-accent transition-all duration-700 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {!open ? (
        <div className="mt-5 space-y-2">
          {campaign.targetUrl && (
            <a
              href={campaign.targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-btn border border-default bg-surface px-4 py-2.5 text-sm font-semibold text-secondary transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:bg-surface-sunken hover:text-primary"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Open review link
            </a>
          )}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="w-full rounded-btn bg-accent px-4 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-md"
          >
            {campaign.previouslyRejected ? "Resubmit" : "Participate"}
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="animate-fade-up mt-5 border-t border-default pt-4" style={{ animationDuration: "200ms" }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-primary">Submit your review</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded-full p-1 text-muted transition-all duration-200 hover:scale-110 hover:bg-surface-sunken hover:text-primary"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <ol className="mt-3 space-y-2 text-sm text-secondary">
            <li className="flex items-start gap-2">
              <span className="font-bold text-accent">1.</span>
              <a href={campaign.targetUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-accent transition-colors duration-150 hover:underline">
                Open the review link <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </li>
            <li className="flex items-start gap-2"><span className="font-bold text-accent">2.</span> Leave your honest review.</li>
            <li className="flex items-start gap-2"><span className="font-bold text-accent">3.</span> Upload a screenshot as proof.</li>
          </ol>

          <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-btn border border-dashed border-default bg-surface px-3 py-3 text-sm font-semibold text-secondary transition-all duration-200 hover:border-accent/40 hover:bg-surface-sunken">
            <Upload className="h-4 w-4" aria-hidden="true" />
            <span className="truncate">{file ? file.name : "Choose screenshot (PNG/JPG/WebP)"}</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>

          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500}
            placeholder="Optional note for the reviewer team…"
            className="mt-3 w-full rounded-btn border border-default bg-surface px-3 py-2.5 text-sm text-primary outline-none transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/50" />

          {error && <p className="mt-2 text-sm text-danger">{error}</p>}

          <button type="submit" disabled={pending}
            className="mt-3 w-full rounded-btn bg-accent px-4 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0">
            {pending ? "Submitting…" : "Submit for verification"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function CampaignParticipation({ campaigns, reward }) {
  if (campaigns.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-default bg-surface-raised p-10 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-sunken">
          <Megaphone className="h-6 w-6 text-muted" aria-hidden="true" />
        </span>
        <p className="mt-4 text-sm font-semibold text-primary">No campaigns available right now</p>
        <p className="mt-1 text-sm text-secondary">Check back soon — new campaigns open up regularly.</p>
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {campaigns.map((c, i) => (
        <div key={c.id} className="animate-fade-up h-full" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
          <Card campaign={c} reward={reward} />
        </div>
      ))}
    </div>
  );
}
