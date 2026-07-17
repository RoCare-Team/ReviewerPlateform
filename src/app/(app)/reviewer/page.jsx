import { requireRole } from "../../../lib/auth/guards";
import { ROLES } from "../../../lib/auth/roles";

export const metadata = { title: "Your feedback · ReviewHub" };

export default async function ReviewerHomePage() {
  const user = await requireRole(ROLES.REVIEWER);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-primary">
        Hi{user.name ? `, ${user.name}` : ""}
      </h1>
      <p className="mt-2 text-secondary">
        Feedback you&apos;ve shared with businesses will appear here.
      </p>
    </div>
  );
}
