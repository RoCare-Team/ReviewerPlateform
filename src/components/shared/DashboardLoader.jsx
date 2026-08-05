/**
 * Full-height loading state for the dashboards (reviewer/business/admin).
 * Rendered automatically by Next.js from each role's `loading.jsx` while a
 * page (or any nested page under it) is fetching its data — no client JS,
 * no flash of empty content.
 */
export default function DashboardLoader({ label = "Loading your dashboard…" }) {
  return (
    <div className="animate-fade-up flex min-h-[60vh] flex-col items-center justify-center gap-4" style={{ animationDuration: "300ms" }}>
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 rounded-full border-4 border-default" />
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-accent border-r-accent" />
      </div>
      <p className="text-sm font-medium text-secondary">{label}</p>
    </div>
  );
}
