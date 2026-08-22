import { Building2 } from "lucide-react";
import { requireAdmin } from "../../../../lib/auth/guards";
import dbConnect from "../../../../lib/db";
import User from "../../../../models/User";
import Campaign from "../../../../models/Campaign";
import GmbConnection from "../../../../models/GmbConnection";
import GmbLocation from "../../../../models/GmbLocation";
import GmbReview from "../../../../models/GmbReview";
import { inr } from "../../../../lib/settings";
import OrganisationsTable from "../../../../components/admin/OrganisationsTable";

export const metadata = { title: "Businesses · Admin", robots: { index: false } };

export default async function AdminBusinessesPage() {
  await requireAdmin();
  await dbConnect();

  const businesses = await User.find({ role: "business_owner" })
    .select("name email phone walletBalance status createdAt")
    .sort({ createdAt: -1 })
    .lean();

  const ids = businesses.map((b) => b._id);

  // Pull related data once, then group in memory (avoids N+1 queries).
  const [campaigns, connections, locations, reviews] = await Promise.all([
    Campaign.find({ user: { $in: ids } }).select("user status budget collected targetReviews").lean(),
    GmbConnection.find({ user: { $in: ids }, status: "active" }).select("user").lean(),
    GmbLocation.find({ user: { $in: ids } }).select("user").lean(),
    GmbReview.find({ user: { $in: ids } }).select("user").lean(),
  ]);

  function countBy(list, key = "user") {
    const m = new Map();
    for (const x of list) {
      const k = String(x[key]);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }
  const connCount = countBy(connections);
  const locCount = countBy(locations);
  const reviewCount = countBy(reviews);

  const campByUser = new Map();
  for (const c of campaigns) {
    const k = String(c.user);
    const agg = campByUser.get(k) ?? { total: 0, active: 0, spend: 0, collected: 0, target: 0 };
    agg.total += 1;
    if (c.status === "active") agg.active += 1;
    agg.spend += c.budget ?? 0;
    agg.collected += c.collected ?? 0;
    agg.target += c.targetReviews ?? 0;
    campByUser.set(k, agg);
  }

  // Serialized for the client table: no ObjectIds, no Dates, and currency
  // already formatted so the row markup stays dumb.
  const rows = businesses.map((b) => {
    const k = String(b._id);
    const c = campByUser.get(k) ?? { total: 0, active: 0, spend: 0, collected: 0, target: 0 };
    return {
      id: k,
      name: b.name || "—",
      email: b.email,
      phone: b.phone ? `+91 ${b.phone}` : "—",
      status: b.status,
      walletDisplay: inr(b.walletBalance ?? 0),
      spendDisplay: inr(c.spend),
      joined: new Date(b.createdAt).toLocaleDateString("en-IN"),
      gmbAccounts: connCount.get(k) ?? 0,
      locations: locCount.get(k) ?? 0,
      reviews: reviewCount.get(k) ?? 0,
      total: c.total,
      active: c.active,
      collected: c.collected,
      target: c.target,
    };
  });

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-subtle text-accent">
          <Building2 className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Businesses</h1>
          <p className="text-sm text-secondary">{rows.length} registered</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mt-8 rounded-card border border-dashed border-default bg-surface-raised p-10 text-center">
          <p className="text-sm text-secondary">No businesses registered yet.</p>
        </div>
      ) : (
        <OrganisationsTable rows={rows} />
      )}
    </div>
  );
}
