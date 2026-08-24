import Image from "next/image";
import { requireRole } from "../../../../lib/auth/guards";
import { ROLES } from "../../../../lib/auth/roles";
import dbConnect from "../../../../lib/db";
import GmbConnection from "../../../../models/GmbConnection";
import GmbLocation from "../../../../models/GmbLocation";
import { isConfigured } from "../../../../lib/gmb";
import GmbConnections from "../../../../components/business/GmbConnections";
import PlayStoreConnection from "../../../../models/PlayStoreConnection";
import PlayStoreApp from "../../../../models/PlayStoreApp";
import PlayStoreReview from "../../../../models/PlayStoreReview";
import { isConfigured as playStoreConfigured } from "../../../../lib/playstore";
import PlayStoreConnections from "../../../../components/business/PlayStoreConnections";
import ReviewsTabs from "../../../../components/business/ReviewsTabs";

export const metadata = { title: "Connections · RapportLook Business" };

const STATUS_MESSAGES = {
  connected: { tone: "ok", text: "Google Business Profile connected." },
  denied: { tone: "error", text: "You cancelled the Google connection." },
  invalid_state: { tone: "error", text: "The connection request expired. Please try again." },
  not_configured: { tone: "error", text: "GMB is not configured on the server (missing client id/secret)." },
  error: { tone: "error", text: "Couldn't complete the connection. Please try again." },
};

const PLAYSTORE_STATUS_MESSAGES = {
  connected: { tone: "ok", text: "Play Store account connected." },
  denied: { tone: "error", text: "You cancelled the Google connection." },
  invalid_state: { tone: "error", text: "The connection request expired. Please try again." },
  not_configured: { tone: "error", text: "Play Store is not configured on the server (missing client id/secret)." },
  error: { tone: "error", text: "Couldn't complete the connection. Please try again." },
};

// Other platforms — coming soon.
const SOON = [
  { name: "Trustpilot", logo: "/img/trustpilot.png" },
  { name: "Capterra", logo: "/img/Capterra.png" },
];

export default async function BusinessConnectionsPage({ searchParams }) {
  const user = await requireRole(ROLES.BUSINESS_OWNER);
  const params = await searchParams;
  const notice = STATUS_MESSAGES[params?.gmb] ?? null;
  const playStoreNotice = PLAYSTORE_STATUS_MESSAGES[params?.playstore] ?? null;

  await dbConnect();
  const conns = await GmbConnection.find({ user: user.id }).sort({ createdAt: -1 }).lean();
  const locs = await GmbLocation.find({ connection: { $in: conns.map((c) => c._id) } }).lean();

  // Serialize for the client component (plain objects, string ids, string dates).
  const connections = conns.map((c) => ({
    id: String(c._id),
    googleEmail: c.googleEmail,
    status: c.status || "active",
    lastError: c.lastError || "",
    locations: locs
      .filter((l) => String(l.connection) === String(c._id))
      .map((l) => ({
        id: String(l._id),
        title: l.title,
        locationName: l.locationName,
        address: l.address,
        reviewCount: l.reviewCount ?? 0,
        averageRating: l.averageRating ?? 0,
        lastSyncedAt: l.lastSyncedAt ? new Date(l.lastSyncedAt).toLocaleString("en-IN") : null,
      })),
  }));

  const psConns = await PlayStoreConnection.find({ user: user.id }).sort({ createdAt: -1 }).lean();
  const psApps = await PlayStoreApp.find({ connection: { $in: psConns.map((c) => c._id) } }).lean();
  const psReviews = await PlayStoreReview.find({ app: { $in: psApps.map((a) => a._id) } })
    .sort({ lastModified: -1 })
    .limit(300)
    .lean();

  const playStoreConnections = psConns.map((c) => ({
    id: String(c._id),
    googleEmail: c.googleEmail,
    status: c.status || "active",
    lastError: c.lastError || "",
    apps: psApps
      .filter((a) => String(a.connection) === String(c._id))
      .map((a) => ({
        id: String(a._id),
        packageName: a.packageName,
        label: a.label,
        reviewCount: a.reviewCount ?? 0,
        averageRating: a.averageRating ?? 0,
        lastSyncedAt: a.lastSyncedAt ? new Date(a.lastSyncedAt).toLocaleString("en-IN") : null,
        reviews: psReviews
          .filter((r) => String(r.app) === String(a._id))
          .slice(0, 10)
          .map((r) => ({
            id: String(r._id),
            authorName: r.authorName,
            starRating: r.starRating ?? 0,
            text: r.text,
            appVersionName: r.appVersionName,
            reply: r.reply,
          })),
      })),
  }));

  const gmbContent = (
    <div>
      <p className="text-secondary">
        Connect your Google Business Profile to fetch and sync reviews. You can connect multiple Google accounts,
        each with multiple locations.
      </p>

      {notice && (
        <div
          className={`mt-6 rounded-btn border px-3 py-2 text-sm ${
            notice.tone === "ok"
              ? "border-verified bg-verified-subtle text-verified"
              : "border-danger bg-danger-subtle text-danger"
          }`}
        >
          {notice.text}
          {params?.msg ? ` — ${params.msg}` : ""}
        </div>
      )}

      {!isConfigured() && (
        <div className="mt-6 rounded-btn border border-pending bg-pending-subtle px-3 py-2 text-sm text-primary">
          Set <code>GMB_CLIENT_ID</code> and <code>GMB_CLIENT_SECRET</code> in <code>.env.local</code> to enable the connection.
        </div>
      )}

      <div className="mt-6">
        <GmbConnections connections={connections} />
      </div>
    </div>
  );

  const playStoreContent = (
    <div>
      <p className="text-secondary">
        Connect the Google account that owns your app(s) in Play Console, then add each app&apos;s package name to
        fetch and reply to its reviews.
      </p>

      {playStoreNotice && (
        <div
          className={`mt-6 rounded-btn border px-3 py-2 text-sm ${
            playStoreNotice.tone === "ok"
              ? "border-verified bg-verified-subtle text-verified"
              : "border-danger bg-danger-subtle text-danger"
          }`}
        >
          {playStoreNotice.text}
          {params?.msg ? ` — ${params.msg}` : ""}
        </div>
      )}

      {!playStoreConfigured() && (
        <div className="mt-6 rounded-btn border border-pending bg-pending-subtle px-3 py-2 text-sm text-primary">
          Set <code>PLAYSTORE_CLIENT_ID</code> and <code>PLAYSTORE_CLIENT_SECRET</code> in <code>.env.local</code> to
          enable the connection.
        </div>
      )}

      <div className="mt-6">
        <PlayStoreConnections connections={playStoreConnections} />
      </div>
    </div>
  );

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-primary">Connections</h1>

      <div className="mt-6">
        <ReviewsTabs
          tabs={[
            { key: "gmb", label: "Google Business Profile", icon: "MapPin", count: connections.length, content: gmbContent },
            { key: "playstore", label: "Play Store", icon: "Smartphone", count: playStoreConnections.length, content: playStoreContent },
          ]}
        />
      </div>

      {/* Coming soon */}
      <div className="mt-10">
        <h2 className="text-lg font-bold text-primary">More platforms</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {SOON.map((p) => (
            <div
              key={p.name}
              className="flex items-center justify-between gap-3 rounded-card border border-default bg-surface-raised p-5 opacity-80 shadow-sm"
            >
              <div className="flex items-center gap-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-default bg-surface">
                  <Image src={p.logo} alt={p.name} width={28} height={28} className="h-6 w-6 object-contain" />
                </span>
                <p className="text-sm font-bold text-primary">{p.name}</p>
              </div>
              <span className="rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
                Coming soon
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
