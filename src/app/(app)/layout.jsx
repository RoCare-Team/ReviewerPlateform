import { requireAuth } from "../../lib/auth/guards";

/**
 * Session required for everything under (app).
 *
 * Middleware already bounced anonymous requests, but this check is the one that
 * counts — middleware is an optimistic JWT read that never touches the database.
 * Nested layouts narrow further with requireRole().
 */
export default async function AppLayout({ children }) {
  await requireAuth();

  return <div className="min-h-dvh bg-surface">{children}</div>;
}
