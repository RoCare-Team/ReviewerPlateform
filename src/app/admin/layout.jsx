export const metadata = {
  // Keep the whole admin surface out of search results.
  robots: { index: false, follow: false },
};

/**
 * Shell only — NO guard here on purpose.
 *
 * /admin/login is public and lives under this segment, so a guard at this level
 * would redirect the login page to itself forever. The guard sits one level down
 * in admin/(protected)/layout.jsx, which covers every admin route EXCEPT login.
 * Route groups don't affect the URL, so /admin, /admin/users, etc. are unchanged.
 */
export default function AdminLayout({ children }) {
  return <div className="min-h-dvh bg-surface">{children}</div>;
}
