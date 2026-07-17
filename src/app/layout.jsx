import "./globals.css";
import { SessionProvider } from "next-auth/react";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

export const metadata = {
  // Makes every relative canonical/OG URL below resolve against the real host.
  metadataBase: new URL(APP_URL),
  title: {
    default: "ReviewHub — Customer feedback that stays honest",
    template: "%s",
  },
  description:
    "Collect customer feedback, monitor your Google Business Profile, and reply faster. ReviewHub never buys, sells, or posts reviews.",
  applicationName: "ReviewHub",
  /**
   * ★ PRE-LAUNCH — the whole site is hidden from search engines on purpose.
   *
   * Inherited by every page that doesn't set its own `robots`. DELETE THIS BLOCK
   * ON LAUNCH DAY, or the homepage cannot rank no matter how good its markup is —
   * this is the single most expensive line in the codebase to forget.
   *
   * Note this is a meta tag, NOT a robots.txt Disallow, and that is deliberate:
   * a disallowed page can never be crawled, so the crawler never reads the
   * noindex and the URL can still surface as a bare link. Let them crawl, and
   * tell them not to index.
   */
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
  openGraph: {
    type: "website",
    siteName: "ReviewHub",
    locale: "en_IN",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }) {
  return (
    // data-scroll-behavior: globals.css sets scroll-behavior:smooth on <html>,
    // which tells Next not to animate route-change scroll restoration.
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className="bg-surface text-primary antialiased" suppressHydrationWarning>
        {/* Client-side session for useSession()/RoleGate. It is a convenience for
            rendering, never an authorization boundary — see components/auth/RoleGate. */}
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
