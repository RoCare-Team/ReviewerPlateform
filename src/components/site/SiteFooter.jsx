import Link from "next/link";
import Container from "./Container";

/**
 * Brand social icons. lucide-react removed its deprecated brand glyphs
 * (Facebook, Twitter, Instagram, GitHub, …), so we ship them as inline SVGs.
 * Each takes `className` and renders a currentColor path, matching how the old
 * lucide components were used below.
 */
function Twitter({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

function Linkedin({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286ZM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124ZM7.119 20.452H3.555V9h3.564v11.452ZM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003Z" />
    </svg>
  );
}

function Facebook({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073Z" />
    </svg>
  );
}

function Instagram({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069ZM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0Zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881Z" />
    </svg>
  );
}

function Github({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.5 11.5 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.014 2.898-.014 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.598 24 12.297c0-6.627-5.373-12-12-12Z" />
    </svg>
  );
}

/**
 * Public marketing footer.
 *
 * The "never buys, sells, or posts reviews" line is not filler — data/roles.json
 * scopes reviewers to feedback:submit and nothing here may contradict that. See
 * the copy note at the top of src/app/page.jsx before editing it.
 *
 * Some linked pages (pricing, about, legal) don't exist yet. They're part of the
 * planned platform, so they're linked rather than hidden — but until each page
 * ships, those hrefs 404. Build them, or comment the link out, before launch:
 * a footer full of 404s is a crawl-budget and trust cost.
 */
const COLUMNS = [
  {
    heading: "Product",
    links: [
      { href: "/#features", label: "Features" },
      { href: "/#how-it-works", label: "How it works" },
      { href: "/pricing", label: "Pricing" },
      { href: "/#faq", label: "FAQ" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/about", label: "About us" },
      { href: "/contact", label: "Contact" },
      { href: "/blog", label: "Blog" },
      { href: "/careers", label: "Careers" },
    ],
  },
  {
    heading: "Get started",
    links: [
      { href: "/signup/business", label: "For businesses" },
      { href: "/signup/reviewer", label: "For reviewers" },
      { href: "/login", label: "Log in" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/privacy", label: "Privacy policy" },
      { href: "/terms", label: "Terms & conditions" },
      { href: "/refund", label: "Refund policy" },
    ],
  },
];

// Defined Social Media Configurations
const SOCIALS = [
  { href: "https://twitter.com/reviewhub", label: "Twitter", Icon: Twitter },
  { href: "https://linkedin.com/company/reviewhub", label: "LinkedIn", Icon: Linkedin },
  { href: "https://facebook.com/reviewhub", label: "Facebook", Icon: Facebook },
  { href: "https://instagram.com/reviewhub", label: "Instagram", Icon: Instagram },
  { href: "https://github.com/reviewhub", label: "GitHub", Icon: Github },
];

export default function SiteFooter() {
  return (
    <footer className="border-t border-default/60 bg-surface-sunken">
      <Container className="py-14 sm:py-16">
        {/* Adjusted to lg:grid-cols-6 with Brand Column taking 2 spans for optimal width ratios */}
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-6 lg:gap-8">
          
          {/* Brand & Social Column */}
          <div className="lg:col-span-2">
            <span className="text-lg font-bold tracking-tight text-primary">
              ReviewHub
            </span>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-secondary">
              Verified customer reviews and reputation management. We reward participation, never
              positive ratings — and never buy, sell, or fake a review.
            </p>
            
            {/* Social Icons Row */}
            <ul className="mt-6 flex items-center gap-3 text-muted">
              {SOCIALS.map(({ href, label, Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-default/40 bg-surface transition-all hover:bg-accent/10 hover:text-accent hover:border-accent/25"
                    aria-label={label}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Navigation Link Columns */}
          {COLUMNS.map((col) => (
            <nav key={col.heading} aria-label={col.heading} className="lg:col-span-1">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary/80">
                {col.heading}
              </h2>
              <ul className="mt-4 space-y-3 text-sm font-medium">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link 
                      href={l.href} 
                      className="text-secondary transition-colors duration-150 hover:text-accent"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Footer Base Layer: Split on desktop to prevent vast empty whitespace */}
        <div className="mt-14 border-t border-default/60 pt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-xs font-semibold text-muted">
          <span>&copy; {new Date().getFullYear()} ReviewHub. All rights reserved.</span>
          <span className="text-[10px] uppercase tracking-wider text-muted/60">
            Built for compliance and authenticity
          </span>
        </div>
      </Container>
    </footer>
  );
}