import Link from "next/link";

// Public. No session required — these ARE the pages you use to get one.
// Already-authenticated users are bounced to their home by src/middleware.js.
export default function AuthLayout({ children }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface-sunken px-4 py-12">
      <Link href="/" className="mb-8 text-xl font-semibold tracking-tight text-primary">
        ReviewHub
      </Link>
      {children}
    </div>
  );
}
