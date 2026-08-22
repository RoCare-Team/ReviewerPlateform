import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "react-hot-toast";

// APP_URL is used for server-side redirects/emails (localhost in dev is correct
// there). For SEO metadata we must always resolve against the real production
// domain — falling back to APP_URL here is what was putting the Vercel preview
// host into canonical URLs instead of www.rapportlook.com.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.rapportlook.com";

// Renders `<meta name="color-scheme" content="light">` in <head>. Without
// this, a browser on a dark-OS-theme has nothing telling it what color this
// site's UNSTYLED/transitioning HTML should be — it falls back to its own
// dark default (near-black) for the split second before globals.css loads
// and paints the real (light) --surface background. That's the "page goes
// black" flash reported on /post-login (a bare server-redirect page with a
// full navigation in front of it) — same root cause on any hard navigation,
// not something specific to that one route.
export const viewport = {
  colorScheme: "light",
  themeColor: "#F8FAFC",
};

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

  verification: {
    google: "ZaqDXeuItUdFNaBifXBurGWVIQ0d-A0Z0TXU94McCug",
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

        {/* Single app-wide toast host. Every event (form submit, save, delete,
            connect, resend, etc.) reports through toast.success/toast.error
            from react-hot-toast — see src/lib/toast.js for the shared config. */}
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 4000,
            style: {
              background: "var(--color-surface)",
              color: "var(--color-primary)",
              border: "1px solid var(--color-default)",
              borderRadius: "10px",
              padding: "10px 14px",
              fontSize: "0.875rem",
              boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
            },
            success: {
              iconTheme: { primary: "var(--color-verified)", secondary: "#fff" },
            },
            error: {
              iconTheme: { primary: "var(--color-danger)", secondary: "#fff" },
            },
          }}
        />
      </body>
    </html>
  );
}
