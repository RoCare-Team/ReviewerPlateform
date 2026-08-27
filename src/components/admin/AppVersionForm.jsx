"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { toast } from "../../lib/toast";

/**
 * Admin control for the mobile app's update gate. Whatever is saved here is
 * what GET /api/app-version hands the app at startup — see
 * src/lib/appVersion.js for how the two version numbers turn into a verdict.
 */
const input =
  "w-full rounded-btn border border-default bg-surface px-3 py-2.5 text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/50";

function PlatformFields({ os, label, storeLabel, value, onChange }) {
  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value });

  return (
    <div className="rounded-card border border-default bg-surface-sunken p-4 sm:p-5">
      <h3 className="text-sm font-bold text-primary">{label}</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${os}-latest`} className="mb-1.5 block text-sm font-medium text-primary">
            Latest version
          </label>
          <input id={`${os}-latest`} value={value.latestVersion} onChange={set("latestVersion")}
            placeholder="46.0.1" className={input} />
          <p className="mt-1.5 text-xs text-muted">
            The build that&apos;s live on the store. Anything older sees a dismissible
            &ldquo;update available&rdquo; modal.
          </p>
        </div>
        <div>
          <label htmlFor={`${os}-min`} className="mb-1.5 block text-sm font-medium text-primary">
            Minimum supported version
          </label>
          <input id={`${os}-min`} value={value.minSupportedVersion} onChange={set("minSupportedVersion")}
            placeholder="45.0.0" className={input} />
          <p className="mt-1.5 text-xs text-muted">
            Anything below this is <span className="font-semibold">blocked</span> — the app can&apos;t be
            used until it&apos;s updated. Keep it equal to or below the latest version.
          </p>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${os}-store`} className="mb-1.5 block text-sm font-medium text-primary">
            {storeLabel}
          </label>
          <input id={`${os}-store`} value={value.storeUrl} onChange={set("storeUrl")}
            placeholder="https://" className={input} />
          <p className="mt-1.5 text-xs text-muted">Where the modal&apos;s Update button sends them.</p>
        </div>
      </div>
    </div>
  );
}

export default function AppVersionForm({ initial }) {
  const router = useRouter();
  const [android, setAndroid] = useState(initial.android);
  const [ios, setIos] = useState(initial.ios);
  const [forceUpdate, setForceUpdate] = useState(Boolean(initial.forceUpdate));
  const [updateTitle, setUpdateTitle] = useState(initial.updateTitle);
  const [updateMessage, setUpdateMessage] = useState(initial.updateMessage);
  const [forceTitle, setForceTitle] = useState(initial.forceTitle);
  const [forceMessage, setForceMessage] = useState(initial.forceMessage);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setMsg(null);
    setPending(true);
    const res = await fetch("/api/admin/app-version", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        android,
        ios,
        forceUpdate,
        updateTitle,
        updateMessage,
        forceTitle,
        forceMessage,
      }),
    });
    setPending(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const text = data.error ?? "Update failed.";
      setMsg({ tone: "error", text });
      toast.error(text);
      return;
    }
    setMsg({ tone: "ok", text: "App version settings saved." });
    toast.success("App version settings saved.");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="max-w-4xl">
      <div className="grid gap-4">
        <PlatformFields os="android" label="Android" storeLabel="Play Store URL"
          value={android} onChange={setAndroid} />
        <PlatformFields os="ios" label="iOS" storeLabel="App Store URL"
          value={ios} onChange={setIos} />
      </div>

      {/* The emergency lever, visually separated from the routine numbers
          above because turning it on locks every out-of-date install out. */}
      <div className="mt-5 rounded-card border border-danger/40 bg-danger-subtle p-4 sm:p-5">
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" checked={forceUpdate} onChange={(e) => setForceUpdate(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-danger" />
          <span>
            <span className="flex items-center gap-1.5 text-sm font-bold text-primary">
              <AlertTriangle className="h-4 w-4 text-danger" aria-hidden="true" />
              Force every out-of-date install to update
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-secondary">
              Emergency switch — use it when a shipped build is broken and you can&apos;t wait to
              work out a minimum version. Anyone not on the latest version gets the blocking modal.
              People already on the latest build are never locked out.
            </span>
          </span>
        </label>
      </div>

      <div className="mt-6 border-t border-default pt-6">
        <h3 className="text-sm font-bold text-primary">Modal wording</h3>
        <p className="mt-1 text-xs text-muted">
          Leave blank to use the defaults. The app shows whichever pair matches the situation.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="updateTitle" className="mb-1.5 block text-sm font-medium text-primary">
              Optional update — title
            </label>
            <input id="updateTitle" value={updateTitle} onChange={(e) => setUpdateTitle(e.target.value)} className={input} />
            <label htmlFor="updateMessage" className="mb-1.5 mt-3 block text-sm font-medium text-primary">
              Optional update — message
            </label>
            <textarea id="updateMessage" rows={3} value={updateMessage}
              onChange={(e) => setUpdateMessage(e.target.value)} className={`${input} resize-y`} />
          </div>
          <div>
            <label htmlFor="forceTitle" className="mb-1.5 block text-sm font-medium text-primary">
              Forced update — title
            </label>
            <input id="forceTitle" value={forceTitle} onChange={(e) => setForceTitle(e.target.value)} className={input} />
            <label htmlFor="forceMessage" className="mb-1.5 mt-3 block text-sm font-medium text-primary">
              Forced update — message
            </label>
            <textarea id="forceMessage" rows={3} value={forceMessage}
              onChange={(e) => setForceMessage(e.target.value)} className={`${input} resize-y`} />
          </div>
        </div>
      </div>

      {msg && (
        <p className={`mt-4 text-sm font-medium ${msg.tone === "ok" ? "text-verified" : "text-danger"}`}>{msg.text}</p>
      )}

      <button type="submit" disabled={pending}
        className="mt-5 rounded-btn bg-accent px-5 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition hover:bg-accent-hover disabled:opacity-60">
        {pending ? "Saving…" : "Save app version"}
      </button>
    </form>
  );
}
