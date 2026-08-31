"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CheckCircle2, Clipboard, ClipboardCheck, Clock, Download, ExternalLink, MapPin, Megaphone, RotateCcw, Ticket, Timer, Upload, Star, X, XCircle } from "lucide-react";
import { toast } from "../../lib/toast";
import CampaignDetailsModal from "./CampaignDetailsModal";
import { useCooldownCountdown } from "./ReviewerCooldownNotice";

/**
 * Available-campaign cards for reviewers. The review link is never sent down
 * with the page — "Open review link" first reserves a slot via
 * POST /api/reviewer/campaigns/[id]/claim, which is the only thing that
 * returns the real URL. That reservation holds for a limited window (shown
 * as a countdown below); a screenshot has to be submitted before it expires,
 * otherwise the slot is released back to the pool. This is what stops a
 * campaign needing e.g. 5 reviews from being started by every reviewer at
 * once — see src/lib/claims.js for the reservation logic.
 */
function inr(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

// `onExpire` fires from inside the interval tick (an event, not a render)
// the moment the countdown hits zero, so the caller can react — e.g. bounce
// back to the "start over" state — without a second effect watching the
// derived countdown value.
function useCountdown(expiresAt, onExpire) {
  // Starts unmeasured (null), not a `Date.now()`-derived value — computing
  // that up front ran during SSR too, at a different instant than the
  // client's first render, so the two disagreed on the second and React
  // flagged a hydration mismatch. Staying null until the effect below (which
  // only ever runs client-side, after hydration) measures it for real means
  // server and client render the exact same "no countdown yet" output first.
  const [msLeft, setMsLeft] = useState(null);

  useEffect(() => {
    // Nothing to do here when there's no expiry — the render guard below
    // already returns null off `!expiresAt` alone, so a stale `msLeft` from
    // a previous expiry never leaks through even without resetting it here.
    if (!expiresAt) return;
    let firedExpiry = false;
    const tick = () => {
      const remaining = new Date(expiresAt).getTime() - Date.now();
      setMsLeft(remaining);
      if (remaining <= 0 && !firedExpiry) {
        firedExpiry = true;
        onExpire?.();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onExpire is a fresh closure each render by design
  }, [expiresAt]);

  if (!expiresAt || msLeft === null) return null;
  const totalSeconds = Math.max(0, Math.floor(msLeft / 1000));
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return { totalSeconds, label: `${mm}:${ss}` };
}

function Card({ campaign, cooldown }) {
  // Platform-wide gap between submissions (admin-set, see lib/pacing.js). The
  // server refuses both the claim and the submission while it's running; this
  // just stops the reviewer wasting a tap to find that out. A card whose slot
  // is ALREADY booked isn't locked — they're mid-flow on a slot they reserved
  // before the cooldown started, and the submit call is the real gate anyway.
  const cooldownBlocked = Boolean(cooldown?.blocked);
  const reward = campaign.reward;
  const router = useRouter();
  // Resume an already-live claim on mount instead of always starting from
  // "not booked" — page.jsx passes down this reviewer's real, server-side
  // expiresAt for any campaign they already have a reserved slot on, so
  // navigating away and back (or just re-rendering) doesn't lose the
  // countdown and force a re-click that used to reset the 30-minute timer.
  const [open, setOpen] = useState(() => Boolean(campaign.activeClaimExpiresAt));
  // "View campaign" — a non-committal peek at how this campaign works before
  // reserving a slot. Never touches the server on its own; the modal's own
  // "Book slot" button is what actually calls claimAndOpen.
  const [showInfo, setShowInfo] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [expiresAt, setExpiresAt] = useState(() => campaign.activeClaimExpiresAt ?? null);
  const [reviewText, setReviewText] = useState(() => campaign.activeReviewText || "");
  const [imageUrl, setImageUrl] = useState(() => campaign.activeImageUrl || "");
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [file, setFile] = useState(null);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  // Slot expired before they submitted — bounce back to the "start over"
  // state and refresh so the campaign's remaining count is accurate.
  const countdown = useCountdown(expiresAt, () => {
    toast.error("Your reserved slot expired. Open the review link again to reserve a new one.");
    setOpen(false);
    setExpiresAt(null);
    setReviewText("");
    setImageUrl("");
    setDownloaded(false);
    router.refresh();
  });
  // Live remainder of the platform cooldown, shared with the page-level
  // notice so both tick together. Refreshes on zero, which re-enables the
  // book button from the server rather than from a guess on the client.
  const cooldownLeft = useCooldownCountdown(cooldown?.nextAvailableAt, () => router.refresh());

  // `openLink`: false for the very first "reserve a slot" click — the
  // reviewer should SEE the copy-review/download-image panel first, not get
  // bounced straight to the review page before they even know those exist.
  // true for the explicit "Open the review link" step inside that panel,
  // once they're actually ready to go post it (this also renews the claim's
  // timer, same as before).
  async function claimAndOpen(openLink = false) {
    setClaiming(true);
    setError("");
    const res = await fetch(`/api/reviewer/campaigns/${campaign.id}/claim`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setClaiming(false);

    if (!res.ok) {
      toast.error(data.error ?? "Couldn't reserve a slot.");
      if (res.status === 400) router.refresh(); // likely just went full — drop it from the list
      return;
    }

    setExpiresAt(data.expiresAt);
    setReviewText(data.reviewText || "");
    setImageUrl(data.imageUrl || "");
    setOpen(true);

    // Order matters, and it's deliberate: copy the review text, download the
    // attach-image, THEN (if requested) open the review link — everything
    // the reviewer needs is already in hand (clipboard + downloads folder)
    // before the review page shows up. window.open() also shifts focus to
    // the new tab, and browsers refuse clipboard/programmatic-download
    // actions once this document isn't the focused one anymore — so both
    // have to happen BEFORE it, not after.
    // A resubmission skips the copy/download/open-link side effects entirely
    // — the review's already posted, so there's nothing here for the
    // reviewer to act on (see the previouslyRejected branch in the form
    // below, which hides these steps for the same reason).
    if (!campaign.previouslyRejected) {
      if (data.reviewText) await copyReviewText(data.reviewText);
      if (data.imageUrl) await downloadImage(data.imageUrl);
      if (openLink) window.open(data.targetUrl, "_blank", "noopener,noreferrer");
    }
  }

  async function copyReviewText(text = reviewText) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Review copied — paste it on the review page.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select and copy the text manually.");
    }
  }

  // A plain <a download href="https://res.cloudinary.com/..."> only works
  // for same-origin URLs — browsers silently ignore the `download` attribute
  // cross-origin and just navigate/open the image instead. Fetching the
  // image ourselves and saving it as a blob forces an actual file download
  // regardless of origin.
  async function downloadImage(url = imageUrl) {
    setDownloading(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Download failed.");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `review-photo-${campaign.id}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
      setDownloaded(true);
      toast.success("Image downloaded — attach it to your review.");
    } catch {
      toast.error("Couldn't download the image — try the button again.");
    } finally {
      setDownloading(false);
    }
  }

  // Local preview for whatever screenshot is currently selected — chosen via
  // the file picker or pasted from the clipboard, doesn't matter which.
  // Derived (not stateful) so there's nothing to reset when `file` clears —
  // the object URL just stops being created. The effect below only revokes
  // it, never sets state.
  const filePreview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview);
    };
  }, [filePreview]);

  // Ctrl/Cmd+V anywhere while the submit panel is open grabs an image straight
  // off the clipboard (e.g. a screenshot copied with Win+Shift+S) — same
  // effect as picking it from the file dialog, just faster.
  useEffect(() => {
    if (!open) return;
    function onPaste(e) {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      if (!item) return;
      const pasted = item.getAsFile();
      if (!pasted) return;
      e.preventDefault();
      setFile(pasted);
      toast.success("Image pasted.");
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [open]);

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
        <p className="mt-1 text-lg font-bold text-primary">{tone.headline}</p>

        {approved && (
          <p className="nums mt-1 text-2xl font-bold text-verified">+{inr(result.reward)}</p>
        )}

        {result.reason && (
          <div className="mt-4 w-full text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {rejected ? "Why it wasn't verified" : "Note"}
            </p>
            <div className={`mt-1 w-full rounded-card border px-4 py-3 text-sm leading-relaxed ${tone.box}`}>
              {result.reason}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            // "Try again" (rejected only) — the server already released this
            // reviewer's claim and allows a fresh submission (see
            // /api/reviewer/submissions), but `result` is local state that
            // router.refresh() alone never clears, so the rejection panel
            // used to stay on screen forever no matter how many times this
            // was clicked. Reset back to the campaign's initial, unclaimed
            // view so the reviewer can reserve a new slot and retry.
            if (rejected) {
              setResult(null);
              setError("");
              setFile(null);
              setNote("");
              setOpen(false);
              setExpiresAt(null);
              setReviewText("");
              setImageUrl("");
              setCopied(false);
              setDownloaded(false);
            }
            router.refresh();
          }}
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
        {rejected && (
          <p className="mt-2 text-xs text-muted">
            Post your review on the site, then screenshot the review itself (not a QR code or landing page) — you can resubmit right away.
          </p>
        )}
      </div>
    );
  }

  const pct = campaign.target ? Math.min(100, Math.round((campaign.collected / campaign.target) * 100)) : 0;

  return (
    <div className="group flex h-full min-w-0 flex-col overflow-hidden rounded-card border border-default bg-surface-raised shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-accent/30 hover:shadow-lg">
      {/* Top strip: icon, name/business, reward — reward pinned as its own
          badge so it never has to fight the title for space on narrow cards. */}
      <div className="flex items-start gap-3 p-5 pb-0">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-subtle text-accent transition-transform duration-300 group-hover:scale-110">
          <Megaphone className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 truncate text-base font-bold text-primary">{campaign.name}</h3>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-subtle px-2.5 py-1 text-xs font-bold text-accent">
              <Star className="h-3.5 w-3.5 fill-accent text-accent" aria-hidden="true" />
              {inr(reward)}
            </span>
          </div>
          {campaign.businessName && (
            <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs font-semibold text-secondary" title={campaign.businessCategory}>
              <Building2 className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="min-w-0 truncate">
                {campaign.businessName}
                {campaign.businessCategory && <span className="font-normal text-muted"> · {campaign.businessCategory}</span>}
              </span>
            </p>
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1 px-5 pb-5">
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-default pb-3">
          <span className="text-xs font-medium capitalize text-muted">{campaign.platform}</span>
          {campaign.cities?.length > 0 && (
            <span
              className="inline-flex items-center gap-1 text-xs font-medium text-muted"
              title={campaign.cities.join(", ")}
            >
              <MapPin className="h-3 w-3" aria-hidden="true" />
              {campaign.cities.length === 1 ? campaign.cities[0] : `${campaign.cities[0]} +${campaign.cities.length - 1} more`}
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-verified-subtle px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-verified">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-verified opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-verified" />
            </span>
            Live
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
            <div className="flex items-center justify-between gap-2 text-xs font-medium text-secondary">
              <span className="nums">{campaign.collected}/{campaign.target} collected</span>
              <span className="nums inline-flex shrink-0 items-center rounded-full bg-accent-subtle px-2 py-0.5 font-bold text-accent">
                {campaign.remaining} left
              </span>
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
        <div className="mt-5 flex-1 flex flex-col justify-end">
          {/* Stacked on narrow screens, side-by-side from sm up — a fixed-
              width "View campaign" next to a flex-1 "Book slot" refused to
              shrink below its own content on very narrow viewports (375px)
              and overflowed the whole card horizontally instead of wrapping. */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setShowInfo(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-btn border border-default bg-surface px-3.5 py-2.5 text-sm font-semibold text-secondary transition-all duration-200 hover:border-accent/40 hover:text-primary"
            >
              View campaign
            </button>
            <button
              type="button"
              onClick={() => claimAndOpen(false)}
              disabled={claiming || cooldownBlocked}
              title={cooldownBlocked ? `You can start your next review in ${cooldown.waitLabel}.` : undefined}
              className="flex min-w-0 items-center justify-center gap-2 rounded-btn bg-accent px-4 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 sm:flex-1"
            >
              {cooldownBlocked ? <Timer className="h-4 w-4 shrink-0" aria-hidden="true" /> : <Ticket className="h-4 w-4 shrink-0" aria-hidden="true" />}
              {cooldownBlocked ? "On cooldown" : claiming ? "Booking…" : campaign.previouslyRejected ? "Resubmit" : "Book slot"}
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] leading-snug text-muted">
            {cooldownBlocked
              ? `Your next review unlocks in ${cooldownLeft ?? cooldown.waitLabel} — reviews have to be ${cooldown.hours} hour${cooldown.hours === 1 ? "" : "s"} apart.`
              : "Reserves your spot & preps your review text/photo — opens automatically once you’re set."}
          </p>

          {showInfo && (
            <CampaignDetailsModal
              campaign={campaign}
              claiming={claiming}
              blockedReason={
                cooldownBlocked
                  ? `You can start your next review in ${cooldownLeft ?? cooldown.waitLabel}.`
                  : ""
              }
              onClose={() => setShowInfo(false)}
              onBook={async () => {
                setShowInfo(false);
                await claimAndOpen(false);
              }}
            />
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="animate-fade-up mt-5 border-t border-default pt-4" style={{ animationDuration: "200ms" }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-primary">Submit your review</span>
            <button
              type="button"
              onClick={() => { setOpen(false); setExpiresAt(null); setReviewText(""); setImageUrl(""); setDownloaded(false); setFile(null); }}
              aria-label="Close"
              className="rounded-full p-1 text-muted transition-all duration-200 hover:scale-110 hover:bg-surface-sunken hover:text-primary"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {countdown && (
            <p className={`mt-2 flex items-center gap-1.5 text-xs font-semibold ${countdown.totalSeconds <= 60 ? "text-danger" : "text-pending"}`}>
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              Slot reserved — submit within {countdown.label} or it&apos;s released to other reviewers.
            </p>
          )}

          {/* A resubmission means the review itself is already posted (that's
              what got rejected — the screenshot, not the review) — so the
              review-link/copy-text/photo-download steps that walk a FIRST-time
              reviewer through posting a review don't apply here. Re-showing
              "Open the review link" would let them re-post the same review
              text on top of their existing one, which is never what a
              rejected-then-retrying reviewer needs — they just need a fresh
              screenshot. */}
          {!campaign.previouslyRejected && (
            <>
              {reviewText && (
                <div className="mt-3 rounded-card border border-accent-border bg-accent-subtle p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-accent">Use this in your review</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-primary">{reviewText}</p>
                  <button
                    type="button"
                    onClick={copyReviewText}
                    className="mt-2.5 inline-flex items-center gap-1.5 rounded-btn border border-accent bg-surface px-3 py-1.5 text-xs font-semibold text-accent transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent hover:text-on-brand"
                  >
                    {copied ? <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" /> : <Clipboard className="h-3.5 w-3.5" aria-hidden="true" />}
                    {copied ? "Copied" : "Copy review"}
                  </button>
                </div>
              )}

              {imageUrl && (
                <div className="mt-3 rounded-card border border-accent-border bg-accent-subtle p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-accent">
                    Attach this photo to your review {downloaded && <span className="text-verified">· Downloaded</span>}
                  </p>
                  <img src={imageUrl} alt="" className="mt-2 h-28 w-full rounded-btn border border-default object-cover" />
                  <button
                    type="button"
                    onClick={() => downloadImage()}
                    disabled={downloading}
                    className="mt-2.5 inline-flex items-center gap-1.5 rounded-btn border border-accent bg-surface px-3 py-1.5 text-xs font-semibold text-accent transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent hover:text-on-brand disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    {downloading ? "Downloading…" : downloaded ? "Download again" : "Download image"}
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => claimAndOpen(true)}
                disabled={claiming}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-btn bg-accent px-4 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                {claiming ? "Opening…" : "1. Open the review link"}
              </button>

              <ol className="mt-3 space-y-2 text-sm text-secondary">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-accent">2.</span>
                  {reviewText ? "Paste the copied review above" : "Leave your honest review"}
                  {imageUrl ? " and attach the downloaded photo." : "."}
                </li>
                <li className="flex items-start gap-2"><span className="font-bold text-accent">3.</span> Upload a screenshot as proof.</li>
              </ol>
            </>
          )}

          {campaign.previouslyRejected && (
            <p className="mt-3 text-sm text-secondary">
              Your review is already posted — just upload a fresh screenshot of it below.
            </p>
          )}

          {file && filePreview ? (
            <div className="mt-4 flex items-center gap-3 rounded-btn border border-default bg-surface p-2">
              <img src={filePreview} alt="Screenshot preview" className="h-16 w-16 shrink-0 rounded-btn border border-default object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-primary">{file.name}</p>
                <label className="mt-1 inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-accent hover:underline">
                  <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                  Replace
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </label>
              </div>
              <button type="button" onClick={() => setFile(null)} aria-label="Remove screenshot"
                className="rounded-full p-1 text-muted transition-all duration-200 hover:scale-110 hover:bg-surface-sunken hover:text-primary">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-btn border border-dashed border-default bg-surface px-3 py-3 text-sm font-semibold text-secondary transition-all duration-200 hover:border-accent/40 hover:bg-surface-sunken">
              <Upload className="h-4 w-4" aria-hidden="true" />
              <span className="truncate">Choose screenshot or paste (Ctrl+V)</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          )}

          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500}
            placeholder="Optional note for the reviewer team…"
            className="mt-3 w-full rounded-2xl border border-default bg-surface px-3 py-2.5 text-sm text-primary outline-none transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/50" />

          {error && <p className="mt-2 text-sm text-danger">{error}</p>}

          <div className="mt-3 flex justify-end">
            <button type="submit" disabled={pending}
              className="w-1/2 rounded-btn bg-accent px-4 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0">
              {pending ? "Submitting…" : "Submit"}
            </button>
          </div>
        </form>
      )}
      </div>
    </div>
  );
}

// If the reviewer arrived via a "Resubmit with a new screenshot" link from
// their submissions history (#campaign-<id>), the target card can be
// anywhere in the grid — scroll straight to it and flash it briefly so it's
// obvious which one just got highlighted, instead of making them hunt for it
// across a whole page of campaigns.
function useHashHighlight() {
  const [highlightId, setHighlightId] = useState(null);
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Deferred, not called directly in the effect body — setting state
    // synchronously here would trigger a cascading render during the same
    // commit (react-hooks/set-state-in-effect).
    const onId = setTimeout(() => setHighlightId(hash.slice(1)), 0);
    const offId = setTimeout(() => setHighlightId(null), 2500);
    return () => {
      clearTimeout(onId);
      clearTimeout(offId);
    };
  }, []);
  return highlightId;
}

/**
 * "Nothing here" is the screen a reviewer sees most often, and on its own it
 * is indistinguishable from a broken app — which is exactly how it kept being
 * reported. `waiting` (see lib/reviewerCampaigns.js) says whether their city
 * HAS campaigns that are simply busy: every slot taken, or the campaign's own
 * drip pacing still running. Quoting the next one to open turns a dead end
 * into a wait.
 */
function EmptyState({ waiting = [], city = "" }) {
  const paced = waiting.filter((w) => w.reason === "paced" && w.availableAt);
  const soonest = paced[0]?.availableAt ? new Date(paced[0].availableAt) : null;
  const minutesAway = soonest ? Math.max(1, Math.round((soonest - Date.now()) / 60000)) : null;
  const opensIn =
    minutesAway === null
      ? ""
      : minutesAway < 60
        ? `about ${minutesAway} minute${minutesAway === 1 ? "" : "s"}`
        : `about ${Math.round(minutesAway / 60)} hour${Math.round(minutesAway / 60) === 1 ? "" : "s"}`;

  return (
    <div className="rounded-card border border-dashed border-default bg-surface-raised p-10 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-sunken">
        <Megaphone className="h-6 w-6 text-muted" aria-hidden="true" />
      </span>
      <p className="mt-4 text-sm font-semibold text-primary">No campaigns available right now</p>
      {waiting.length === 0 ? (
        <p className="mt-1 text-sm text-secondary">
          {city
            ? `Nothing is running for ${city} at the moment. Check back soon — new campaigns open up regularly.`
            : "Check back soon — new campaigns open up regularly."}
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-secondary">
            {waiting.length} campaign{waiting.length === 1 ? " is" : "s are"} running{city ? ` in ${city}` : ""}, but{" "}
            {waiting.length === 1 ? "it is" : "they are"} busy right now — every spot is either taken or spaced out to
            keep reviews looking natural.
          </p>
          {opensIn && (
            <p className="mt-2 text-sm font-semibold text-accent">The next one opens in {opensIn}.</p>
          )}
        </>
      )}
    </div>
  );
}

export default function CampaignParticipation({ campaigns, cooldown, waiting = [], city = "" }) {
  const highlightId = useHashHighlight();

  if (campaigns.length === 0) {
    return <EmptyState waiting={waiting} city={city} />;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {campaigns.map((c, i) => (
        <div
          key={c.id}
          id={`campaign-${c.id}`}
          className={`animate-fade-up h-full min-w-0 scroll-mt-24 rounded-card transition-shadow duration-500 ${
            highlightId === `campaign-${c.id}` ? "ring-2 ring-accent ring-offset-2 ring-offset-surface" : ""
          }`}
          style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
        >
          <Card campaign={c} cooldown={cooldown} />
        </div>
      ))}
    </div>
  );
}
