import Link from "next/link";

/**
 * Public marketing footer.
 *
 * The "never buys, sells, or posts reviews" line is not filler — data/roles.json
 * scopes reviewers to feedback:submit and nothing here may contradict that. See
 * the copy note at the top of src/app/page.jsx before editing it.
 *
 * Columns whose pages don't exist yet are omitted rather than linked to 404s —
 * broken internal links are a crawl-budget and trust cost. Add each link when
 * its page lands.
 */
const COLUMNS = [
  {
    heading: "Product",
    links: [
      { href: "/#how-it-works", label: "How it works" },
      { href: "/#faq", label: "FAQ" },
    ],
  },
  {
    heading: "Get started",
    links: [
      { href: "/signup/business", label: "For businesses" },
      { href: "/signup/reviewer", label: "For customers" },
      { href: "/login", label: "Log in" },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="border-t border-default bg-surface-sunken">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
          <div className="max-w-xs">
            <span className="text-base font-semibold tracking-tight text-primary">ReviewHub</span>
            <p className="mt-3 text-sm text-secondary">
              Honest customer feedback. We never buy, sell, post, or remove reviews.
            </p>
          </div>

          <div className="flex gap-12">
            {COLUMNS.map((col) => (
              <nav key={col.heading} aria-label={col.heading}>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
                  {col.heading}
                </h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="text-secondary hover:text-primary">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-10 border-t border-default pt-6 text-sm text-muted">
          {/* Static export: this is stamped at build time, not per request. */}
          <span>&copy; {new Date().getFullYear()} ReviewHub</span>
        </div>
      </div>
    </footer>
  );
}
