import { Users as UsersIcon } from "lucide-react";
import { requireAdmin } from "../../../../lib/auth/guards";
import dbConnect from "../../../../lib/db";
import User from "../../../../models/User";
import { inr } from "../../../../lib/settings";
import UsersTable from "../../../../components/admin/UsersTable";

export const metadata = { title: "Users · Admin", robots: { index: false } };

export default async function AdminUsersPage({ searchParams }) {
  await requireAdmin();
  const params = await searchParams;
  const roleFilter = params?.role;

  await dbConnect();
  const query = ["business_owner", "reviewer", "admin"].includes(roleFilter) ? { role: roleFilter } : {};
  const users = await User.find(query)
    .select("name email role status walletBalance createdAt lastLoginAt phone")
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();

  // Serialized for the client table — no ObjectIds or Dates cross the boundary.
  const rows = users.map((u) => ({
    id: String(u._id),
    name: u.name || "",
    // Reviewer/business_owner sign in by phone (roles.json) and often have no
    // email at all — fall back to phone so the table/search never has to deal
    // with an undefined field.
    email: u.email || u.phone || "",
    role: u.role,
    status: u.status,
    walletDisplay: inr(u.walletBalance ?? 0),
    joined: new Date(u.createdAt).toLocaleDateString("en-IN"),
    lastLogin: u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString("en-IN") : "—",
  }));

  const tabs = [
    { key: "", label: "All" },
    { key: "business_owner", label: "Businesses" },
    { key: "reviewer", label: "Reviewers" },
    { key: "admin", label: "Admins" },
  ];

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-subtle text-accent">
          <UsersIcon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Users</h1>
          <p className="text-sm text-secondary">{rows.length} registered</p>
        </div>
      </div>

      {/* Role filter tabs */}
      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map((t) => {
          const active = (roleFilter ?? "") === t.key;
          return (
            <a
              key={t.label}
              href={t.key ? `/admin/users?role=${t.key}` : "/admin/users"}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
                active
                  ? "border-accent bg-accent-subtle text-accent"
                  : "border-default bg-surface text-secondary hover:bg-surface-sunken"
              }`}
            >
              {t.label}
            </a>
          );
        })}
      </div>

      <UsersTable rows={rows} />
    </div>
  );
}
