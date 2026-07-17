import { Suspense } from "react";
import Link from "next/link";
import AuthCard from "../../../components/auth/AuthCard";
import LoginForm from "../../../components/auth/LoginForm";
import GoogleButton from "../../../components/auth/GoogleButton";

export const metadata = {
  title: "Sign in · ReviewHub",
};

// Shared by reviewers and business owners. Admin has its own at /admin/login.
export default async function LoginPage({ searchParams }) {
  // Next 16: searchParams is a Promise. Sync access was removed, not deprecated.
  const params = await searchParams;

  const notice =
    params?.e === "inactive"
      ? "Your account isn't active yet. Verify your email to continue."
      : null;

  return (
    <AuthCard
      title="Sign in"
      subtitle="Welcome back to ReviewHub."
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
        <LoginForm scope="user" />
      </Suspense>

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-default" />
        <span className="text-xs text-muted">OR</span>
        <span className="h-px flex-1 bg-default" />
      </div>

      {/* Identity only. Not the GBP connection — that lives in the business app. */}
      <GoogleButton callbackUrl="/post-login" />
    </AuthCard>
  );
}
