import "./globals.css";
import { SessionProvider } from "next-auth/react";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(APP_URL),

  title: {
    default: "RapportLook — Customer feedback that stays honest",
    template: "%s",
  },

  description:
    "Collect customer feedback, monitor your Google Business Profile, and reply faster. RapportLook never buys, sells, or posts reviews.",

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

  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
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
