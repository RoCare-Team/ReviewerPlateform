import { Smartphone, Apple, ShieldAlert } from "lucide-react";
import { requireAdmin } from "../../../../lib/auth/guards";
import { getAppVersionConfig } from "../../../../lib/appVersion";
import AppVersionForm from "../../../../components/admin/AppVersionForm";

export const metadata = { title: "App version · Admin", robots: { index: false } };

const SAMPLE = `GET /api/app-version?platform=android&version=45.0.0

{
  "ok": true,
  "platform": "android",
  "currentVersion": "45.0.0",
  "latestVersion": "46.0.1",
  "minSupportedVersion": "45.0.0",
  "updateAvailable": true,
  "forceUpdate": false,
  "storeUrl": "https://play.google.com/store/apps/details?id=...",
  "title": "Update available",
  "message": "A new version of the app is available…",
  "config": { "android": { … }, "ios": { … } }
}`;

export default async function AdminAppVersionPage() {
  await requireAdmin();
  const config = await getAppVersionConfig();

  const STATS = [
    { label: "Android — latest", value: config.android.latestVersion, sub: `min ${config.android.minSupportedVersion}`, icon: Smartphone },
    { label: "iOS — latest", value: config.ios.latestVersion, sub: `min ${config.ios.minSupportedVersion}`, icon: Apple },
    { label: "Force update", value: config.forceUpdate ? "ON" : "Off", sub: config.forceUpdate ? "Every old build is blocked" : "Only below minimum is blocked", icon: ShieldAlert },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-primary">App version</h1>
      <p className="mt-2 max-w-3xl text-secondary">
        Controls the update modal in the mobile app. The app calls{" "}
        <code className="rounded bg-surface-sunken px-1.5 py-0.5 text-sm text-primary">/api/app-version</code>{" "}
        at startup and the server tells it what to show — so you can force an update without
        shipping a new build.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {STATS.map(({ label, value, sub, icon: Icon }) => (
          <div key={label} className="rounded-card border border-default bg-surface-raised p-4 shadow-sm">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-subtle text-accent">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <p className="mt-2.5 text-xs font-medium leading-tight text-secondary">{label}</p>
            <p className="nums mt-1 text-xl font-bold text-primary">{value}</p>
            <p className="mt-0.5 text-[11px] leading-tight text-muted">{sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-card border border-default bg-surface-raised p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-bold text-primary">Edit app version</h2>
        <div className="mt-4">
          <AppVersionForm initial={config} />
        </div>
      </div>

      {/* Kept on the page rather than in a doc nobody can find — this is what
          gets pasted to whoever is building the app. */}
      <div className="mt-8 rounded-card border border-default bg-surface-raised p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-bold text-primary">For the app developer</h2>
        <p className="mt-2 text-sm leading-relaxed text-secondary">
          Call this once on launch, before the login screen. Send the platform and the version the
          app is running, then branch on two booleans:{" "}
          <code className="rounded bg-surface-sunken px-1.5 py-0.5 text-xs text-primary">forceUpdate</code>{" "}
          → blocking modal with no dismiss;{" "}
          <code className="rounded bg-surface-sunken px-1.5 py-0.5 text-xs text-primary">updateAvailable</code>{" "}
          → dismissible modal; both false → show nothing. The Update button opens{" "}
          <code className="rounded bg-surface-sunken px-1.5 py-0.5 text-xs text-primary">storeUrl</code>.
          No auth header needed. If the call fails, let the user in — never block on a network error.
        </p>
        <div className="mt-4 overflow-x-auto rounded-card border border-default bg-surface-sunken p-4">
          <pre className="text-xs leading-relaxed text-secondary">{SAMPLE}</pre>
        </div>
      </div>
    </div>
  );
}
