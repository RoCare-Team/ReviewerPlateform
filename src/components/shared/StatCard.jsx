import Link from "next/link";
import { ChevronRight } from "lucide-react";

const RAIL = {
  "text-accent": "var(--accent)",
  "text-verified": "var(--verified)",
  "text-pending": "var(--pending)",
  "text-danger": "var(--danger)",
};
const BG = {
  "text-accent": "bg-accent-subtle",
  "text-verified": "bg-verified-subtle",
  "text-pending": "bg-pending-subtle",
  "text-danger": "bg-danger-subtle",
};

/**
 * The one stat-tile design used across every dashboard (reviewer, business,
 * admin) — icon badge, tone-colored corner glow, big number, optional hint
 * line. `href` makes it a clickable Link to the relevant page; omit it for a
 * static tile with no destination.
 */
export default function StatCard({ label, value, Icon, tone = "text-accent", sub, href }) {
  const rail = RAIL[tone] ?? RAIL["text-accent"];
  const bg = BG[tone] ?? BG["text-accent"];
  const Wrapper = href ? Link : "div";

  return (
    <Wrapper
      {...(href ? { href } : {})}
      className="group relative block overflow-hidden rounded-card border border-default bg-surface-raised p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {/* Soft tone-colored glow in the corner — depth without a garish stripe */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-5 -top-5 h-16 w-16 rounded-full opacity-[0.07] transition-transform duration-500 group-hover:scale-125"
        style={{ backgroundColor: rail }}
      />

      <div className="relative flex items-start justify-between">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${bg} transition-transform duration-300 group-hover:scale-110`}>
          <Icon className={`h-4.5 w-4.5 ${tone}`} aria-hidden="true" />
        </span>
        {href && (
          <ChevronRight
            className="mt-1 h-3.5 w-3.5 shrink-0 text-muted opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100"
            aria-hidden="true"
          />
        )}
      </div>

      <p className="relative mt-3 truncate text-xs font-medium text-secondary">{label}</p>
      <p className="nums relative mt-0.5 text-2xl font-bold leading-none tracking-tight text-primary">{value}</p>
      {sub && <p className="relative mt-1.5 truncate text-[11px] text-muted">{sub}</p>}
    </Wrapper>
  );
}
