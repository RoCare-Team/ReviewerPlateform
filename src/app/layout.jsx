import "./globals.css";
import { SessionProvider } from "next-auth/react";

// APP_URL is used for server-side redirects/emails (localhost in dev is correct
// there). For SEO metadata we must always resolve against the real production
// domain — falling back to APP_URL here is what was putting the Vercel preview
// host into canonical URLs instead of www.rapportlook.com.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.rapportlook.com";

export const metadata = {
  metadataBase: new URL(SITE_URL),

  title: {
    default: "RapportLook — Customer feedback that stays honest",
    template: "%s",
  },

  description:
    "Collect customer feedback, monitor your Google Business Profile, and reply faster. RapportLook never buys, sells, or posts reviews.",

  keywords: [
    "customer review platform",
    "verified customer reviews",
    "Google reviews management",
    "review collection software",
    "reputation management",
    "customer feedback tool",
    "Google Business Profile reviews",
  ],

  applicationName: "RapportLook",

  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
    other: [
      {
        rel: "manifest",
        url: "/site.webmanifest",
      },
    ],
  },

  // Public marketing pages are indexable by default; signed-in dashboards,
  // auth flows, and admin routes override this to noindex in their own layouts.
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },

  openGraph: {
    type: "website",
    siteName: "RapportLook",
    locale: "en_IN",
  },

  twitter: {
    card: "summary_large_image",
  },
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
