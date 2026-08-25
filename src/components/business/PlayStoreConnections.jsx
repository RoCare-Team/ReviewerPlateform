"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MessageSquare,
  Package,
  Plus,
  RefreshCw,
  Reply,
  Send,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "../../lib/toast";

/**
 * Client UI for connected Play Store (androidpublisher) accounts. Mirrors
 * GmbConnections.jsx: receives already-serialized connections (with their
 * tracked apps + recent reviews) from the server page and drives the
 * add-app / sync / reply / disconnect API routes.
 */
export default function PlayStoreConnections({ connections }) {
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const [pkgInput, setPkgInput] = useState({}); // { [connectionId]: value }
  const [replyDraft, setReplyDraft] = useState({}); // { [reviewId]: value }
  const [replyOpen, setReplyOpen] = useState(null); // reviewId currently editing

  async function addApp(connectionId) {
    const packageName = (pkgInput[connectionId] || "").trim();
    if (!packageName) return;
    setBusy(`add-${connectionId}`);
    const res = await fetch("/api/business/playstore/apps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId, packageName }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      toast.error(data.error ?? "Couldn't add app.");
      return;
    }
    setPkgInput((p) => ({ ...p, [connectionId]: "" }));
    toast.success("App added — sync to fetch its reviews.");
    router.refresh();
  }

  async function removeApp(appId) {
    if (!confirm("Stop tracking this app? Its synced reviews will be removed.")) return;
    setBusy(appId);
    const res = await fetch(`/api/business/playstore/apps/${appId}`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Remove failed.");
      return;
    }
    toast.success("App removed.");
    router.refresh();
  }

  async function sync(id) {
    setBusy(id);
    const res = await fetch("/api/business/playstore/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId: id }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      toast.error(data.error ?? "Sync failed.");
      return;
    }
    const errNote = data.errors?.length ? ` (${data.errors.length} app error(s))` : "";
    toast.success(`Synced ${data.synced} review(s)${errNote}.`);
    router.refresh();
  }

  async function disconnect(id) {
    if (!confirm("Disconnect this Google account? Its tracked apps and reviews will be removed.")) return;
    setBusy(id);
    const res = await fetch(`/api/business/playstore/${id}`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Disconnect failed.");
      return;
    }
    toast.success("Disconnected.");
    router.refresh();
  }

  async function sendReply(reviewId) {
    const text = (replyDraft[reviewId] || "").trim();
    if (!text) return;
    setBusy(`reply-${reviewId}`);
    const res = await fetch("/api/business/playstore/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewId, text }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      toast.error(data.error ?? "Reply failed.");
      return;
    }
    toast.success("Reply posted.");
    setReplyOpen(null);
    router.refresh();
  }

  return (
    <div>
      {connections.length === 0 ? (
        <div className="rounded-card border border-dashed border-default bg-surface-raised p-8 text-center">
          <p className="text-sm text-secondary">No Google account connected yet.</p>
          <a
            href="/api/business/playstore/connect"
            className="mt-4 inline-flex items-center gap-2 rounded-btn bg-accent px-4 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition hover:bg-accent-hover"
          >
            <Image src="/google-play.png" alt="" width={18} height={18} className="h-4 w-4" />
            Connect Google Play Console
          </a>
          <p className="mt-3 text-xs text-muted">
            Connect the Google account that has access to your app(s) in Play Console.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {connections.map((c) => (
            <div key={c.id} className="rounded-card border border-default bg-surface-raised p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-default bg-surface">
                    <Image src="/google-play.png" alt="Play Store" width={22} height={22} className="h-5 w-5 object-contain" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-primary">{c.googleEmail}</p>
                    {c.status === "revoked" || c.status === "error" ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-danger">
                        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                        Reconnect needed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-verified">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Connected
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {c.status === "revoked" || c.status === "error" ? (
                    <a
                      href="/api/business/playstore/connect"
                      className="inline-flex items-center gap-1.5 rounded-btn bg-accent px-3 py-1.5 text-sm font-semibold text-on-brand shadow-sm transition hover:bg-accent-hover"
                    >
                      <RefreshCw className="h-4 w-4" aria-hidden="true" />
                      Reconnect
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => sync(c.id)}
                      disabled={busy === c.id}
                      className="inline-flex items-center gap-1.5 rounded-btn bg-accent px-3 py-1.5 text-sm font-semibold text-on-brand shadow-sm transition hover:bg-accent-hover disabled:opacity-60"
                    >
                      <RefreshCw className={`h-4 w-4 ${busy === c.id ? "animate-spin" : ""}`} aria-hidden="true" />
                      {busy === c.id ? "Syncing…" : "Sync reviews"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => disconnect(c.id)}
                    disabled={busy === c.id}
                    className="inline-flex items-center gap-1.5 rounded-btn border border-default bg-surface px-3 py-1.5 text-sm font-semibold text-danger transition hover:bg-danger-subtle disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Disconnect
                  </button>
                </div>
              </div>

              {c.lastError && (
                <p className="mt-3 rounded-btn bg-danger-subtle px-3 py-2 text-xs text-danger">{c.lastError}</p>
              )}

              {/* Add a package name to track */}
              <div className="mt-4 border-t border-default pt-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Tracked apps ({c.apps.length})</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={pkgInput[c.id] || ""}
                    onChange={(e) => setPkgInput((p) => ({ ...p, [c.id]: e.target.value }))}
                    placeholder="com.example.app (package name from Play Console)"
                    className="min-w-0 flex-1 rounded-btn border border-default bg-surface px-3 py-2 text-sm text-primary outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={() => addApp(c.id)}
                    disabled={busy === `add-${c.id}` || !pkgInput[c.id]?.trim()}
                    className="inline-flex items-center gap-1.5 rounded-btn border border-default bg-surface px-3 py-2 text-sm font-semibold text-primary transition hover:bg-surface-sunken disabled:opacity-60"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add app
                  </button>
                </div>

                {c.apps.length === 0 ? (
                  <p className="mt-3 text-sm text-secondary">
                    No apps tracked yet. Add the package name of an app your connected account manages in Play Console.
                  </p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {c.apps.map((app) => (
                      <div key={app.id} className="rounded-card border border-default bg-surface p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-subtle">
                              <Package className="h-4 w-4 text-accent" aria-hidden="true" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-primary" title={app.packageName}>
                                {app.label || app.packageName}
                              </p>
                              <p className="truncate text-xs text-muted">{app.packageName}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
                              {app.reviewCount > 0 ? app.averageRating.toFixed(1) : "—"}
                              <span className="inline-flex items-center gap-1 font-normal text-muted">
                                <MessageSquare className="h-3 w-3" aria-hidden="true" />
                                {app.reviewCount}
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => removeApp(app.id)}
                              disabled={busy === app.id}
                              className="rounded-btn p-1.5 text-danger transition hover:bg-danger-subtle disabled:opacity-60"
                              title="Stop tracking"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-2 flex items-center gap-1 text-xs text-muted">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          {app.lastSyncedAt ? `Synced ${app.lastSyncedAt}` : "Not synced yet"}
                        </div>

                        {/* Recent reviews */}
                        {app.reviews.length > 0 && (
                          <div className="mt-3 space-y-2.5 border-t border-default pt-3">
                            {app.reviews.map((r) => (
                              <div
                                key={r.id}
                                className="rounded-card border border-default bg-surface-sunken p-3.5"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-semibold text-primary">{r.authorName}</p>
                                  <span className="inline-flex items-center gap-0.5 shrink-0">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                      <Star
                                        key={i}
                                        className={`h-3 w-3 ${i < r.starRating ? "fill-amber-400 text-amber-400" : "text-muted"}`}
                                        aria-hidden="true"
                                      />
                                    ))}
                                  </span>
                                </div>
                                {r.text && <p className="mt-1.5 text-sm leading-relaxed text-secondary">{r.text}</p>}
                                {r.appVersionName && (
                                  <p className="mt-1.5 text-xs text-muted">Version {r.appVersionName}</p>
                                )}

                                {r.reply ? (
                                  <div className="mt-2.5 rounded-card border border-default bg-surface p-3">
                                    <p className="inline-flex items-center gap-1 text-xs font-semibold text-accent">
                                      <Reply className="h-3 w-3" aria-hidden="true" />
                                      Your reply
                                    </p>
                                    <p className="mt-1 text-sm text-secondary">{r.reply}</p>
                                  </div>
                                ) : replyOpen === r.id ? (
                                  <div className="mt-2.5 flex gap-2">
                                    <input
                                      type="text"
                                      value={replyDraft[r.id] || ""}
                                      onChange={(e) => setReplyDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                                      placeholder="Write a reply…"
                                      className="min-w-0 flex-1 rounded-btn border border-default bg-surface px-3 py-1.5 text-sm text-primary outline-none focus:border-accent"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => sendReply(r.id)}
                                      disabled={busy === `reply-${r.id}` || !replyDraft[r.id]?.trim()}
                                      className="inline-flex shrink-0 items-center gap-1 rounded-btn bg-accent px-3 py-1.5 text-xs font-semibold text-on-brand transition hover:bg-accent-hover disabled:opacity-60"
                                    >
                                      <Send className="h-3.5 w-3.5" aria-hidden="true" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setReplyOpen(r.id)}
                                    className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                                  >
                                    <Reply className="h-3 w-3" aria-hidden="true" />
                                    Reply
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          <a
            href="/api/business/playstore/connect"
            className="inline-flex items-center gap-2 rounded-btn border border-default bg-surface px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-surface-sunken"
          >
            <Image src="/google-play.png" alt="" width={18} height={18} className="h-4 w-4" />
            Connect another Google account
          </a>
        </div>
      )}
    </div>
  );
}
