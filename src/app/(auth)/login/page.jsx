import { Suspense } from "react";
import Link from "next/link";
import AuthCard from "../../../components/auth/AuthCard";
import PhoneOtpForm from "../../../components/auth/PhoneOtpForm";

export const metadata = {
  title: "Sign in · RapportLook",
  robots: { index: false, follow: false },
};

// Shared by reviewers and business owners. Admin has its own at /admin/login.
export default async function LoginPage({ searchParams }) {
  // Next 16: searchParams is a Promise. Sync access was removed, not deprecated.
  const params = await searchParams;

  const notice =
    params?.e === "inactive"
      ? "Your account isn't active yet."
      : null;

  return (
    <AuthCard
      title="Sign in"
      subtitle="Welcome back to RapportLook."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-accent hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      {notice ? (
        <div className="mb-4 rounded-btn border border-pending bg-pending-subtle px-3 py-2 text-sm text-primary">
          {notice}
        </div>
      ) : null}

      <Suspense fallback={null}>
        <PhoneOtpForm mode="login" />
      </Suspense>
    </AuthCard>
  );
}
