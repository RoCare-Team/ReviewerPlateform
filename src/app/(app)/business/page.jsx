import { requireRole } from "../../../lib/auth/guards";
import { ROLES } from "../../../lib/auth/roles";

export const metadata = { title: "Overview · ReviewHub Business" };

export default async function BusinessOverviewPage() {
  const user = await requireRole(ROLES.BUSINESS_OWNER);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-primary">
        Welcome back{user.name ? `, ${user.name}` : ""}
      </h1>
      <p className="mt-2 text-secondary">
        Your dashboard is next — campaigns, reviews, and your Google Business Profile
        connection.
      </p>
    </div>
  );
}
