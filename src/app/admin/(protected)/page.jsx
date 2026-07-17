import { requireAdmin } from "../../../lib/auth/guards";

export const metadata = { title: "Admin · ReviewHub" };

export default async function AdminOverviewPage() {
  const user = await requireAdmin();

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-primary">Administration</h1>
      <p className="mt-2 text-secondary">Signed in as {user.email}.</p>
      <p className="mt-6 rounded-card border border-default bg-surface-sunken p-4 text-sm text-secondary">
        Admin sessions last 8 hours, not 30 days like user sessions. You&apos;ll be asked
        to sign in again after that.
      </p>
    </div>
  );
}
