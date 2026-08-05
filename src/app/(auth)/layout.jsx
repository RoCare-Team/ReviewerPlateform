import Image from "next/image";
import Link from "next/link";
import AuthAside from "../../components/auth/AuthAside";

// Public. No session required — these ARE the pages you use to get one.
// Already-authenticated users are bounced to their home by src/middleware.js.
// Login/signup/reset forms carry no search intent and are noindexed.
export const metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }) {
  return (
    <div className="grid h-dvh overflow-hidden lg:grid-cols-2">
      {/* Left: branded content panel (desktop only), copy varies by route */}
      <AuthAside />

      {/* Right: form area — scrolls internally only if the form is taller than
          the viewport, so the window itself never scrolls and nothing is clipped. */}
      <main className="flex h-dvh flex-col overflow-y-auto bg-surface-sunken px-4 py-8 sm:px-6">
        <div className="m-auto w-full max-w-md">
          {/* Mobile logo (the left panel is hidden below lg) */}
          <Link
            href="/"
            aria-label="RapportLook home"
            className="mb-8 inline-flex items-center lg:hidden"
          >
            <Image src="/img/logo.png" alt="RapportLook" width={1138} height={358} className="h-9 w-auto" />
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
