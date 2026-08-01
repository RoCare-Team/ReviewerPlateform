"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Upload, Star, X } from "lucide-react";

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

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!file) return setError("Upload a screenshot of your review.");

    const fd = new FormData();
    fd.append("campaignId", campaign.id);
    fd.append("note", note);
    fd.append("screenshot", file);

    setPending(true);
    const res = await fetch("/api/reviewer/submissions", { method: "POST", body: fd });
    setPending(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error ?? "Submission failed.");
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="rounded-card border border-default bg-surface-raised p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-primary">{campaign.name}</h3>
          <p className="mt-0.5 text-xs font-medium text-muted capitalize">{campaign.platform}</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-verified-subtle px-2.5 py-1 text-xs font-bold text-verified">
          <Star className="h-3.5 w-3.5 fill-verified text-verified" aria-hidden="true" />
          Earn {inr(reward)}
        </span>
      </div>

      {campaign.notes && <p className="mt-3 text-sm leading-relaxed text-secondary">{campaign.notes}</p>}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 w-full rounded-btn bg-accent px-4 py-2 text-sm font-semibold text-on-brand shadow-sm transition hover:bg-accent-hover"
        >
          Participate
        </button>
      ) : (
        <form onSubmit={submit} className="mt-4 border-t border-default pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-primary">Submit your review</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-muted hover:text-primary">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <ol className="mt-3 space-y-2 text-sm text-secondary">
            <li className="flex items-start gap-2">
              <span className="font-bold text-accent">1.</span>
              <a href={campaign.targetUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">
                Open the review link <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </li>
            <li className="flex items-start gap-2"><span className="font-bold text-accent">2.</span> Leave your honest review.</li>
            <li className="flex items-start gap-2"><span className="font-bold text-accent">3.</span> Upload a screenshot as proof.</li>
          </ol>

          <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-btn border border-dashed border-default bg-surface px-3 py-3 text-sm font-semibold text-secondary transition hover:bg-surface-sunken">
            <Upload className="h-4 w-4" aria-hidden="true" />
            {file ? file.name : "Choose screenshot (PNG/JPG/WebP)"}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>

          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500}
            placeholder="Optional note for the reviewer team…"
            className="mt-3 w-full rounded-btn border border-default bg-surface px-3 py-2.5 text-sm text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/50" />

          {error && <p className="mt-2 text-sm text-danger">{error}</p>}

          <button type="submit" disabled={pending}
            className="mt-3 w-full rounded-btn bg-accent px-4 py-2 text-sm font-semibold text-on-brand shadow-sm transition hover:bg-accent-hover disabled:opacity-60">
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
      <div className="rounded-card border border-dashed border-default bg-surface-raised p-8 text-center">
        <p className="text-sm text-secondary">No campaigns available right now. Check back soon.</p>
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {campaigns.map((c) => (
        <Card key={c.id} campaign={c} reward={reward} />
      ))}
    </div>
  );
}
