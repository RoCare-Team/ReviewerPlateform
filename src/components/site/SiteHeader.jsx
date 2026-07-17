import Link from "next/link";

/**
 * Public marketing header. NOT for signed-in surfaces — (app)/* and /admin have
 * their own headers with the session email and a sign-out button.
 *
 * `glass` is deliberate and load-bearing here: globals.css restricts it to the
 * hero and sticky headers, and this is the sticky header. Don't reach for it
 * elsewhere.
 */
const NAV = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#faq", label: "FAQ" },
];

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 glass">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-base font-semibold tracking-tight text-primary hover:text-primary">
          ReviewHub
        </Link>

        <nav aria-label="Main" className="flex items-center gap-4 text-sm">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hidden text-secondary hover:text-primary sm:inline">
              {n.label}
            </Link>
          ))}
          <Link href="/login" className="text-secondary hover:text-primary">
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-btn bg-accent px-3 py-1.5 font-medium text-on-brand transition hover:bg-accent-hover"
          >
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}
