import Link from "next/link";
import AuthCard from "../../../../components/auth/AuthCard";
import SignupForm from "../../../../components/auth/SignupForm";
import GoogleSignupButton from "../../../../components/auth/GoogleSignupButton";
import { ROLES } from "../../../../lib/auth/roles";

export const metadata = {
  title: "Sign up your business · ReviewHub",
};

export default function BusinessSignupPage() {
  return (
    <AuthCard
      title="Create a business account"
      subtitle="Start your 14-day trial. No card required."
      footer={
        <>
          Want to leave feedback instead?{" "}
          <Link href="/signup/reviewer" className="text-accent hover:underline">
            Sign up as a reviewer
          </Link>
        </>
      }
    >
      <SignupForm role={ROLES.BUSINESS_OWNER} />

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-default" />
        <span className="text-xs text-muted">OR</span>
        <span className="h-px flex-1 bg-default" />
      </div>

      <GoogleSignupButton role={ROLES.BUSINESS_OWNER} label="Sign up with Google" />

      {/* Signing in with Google here is identity only. Connecting the Google
          Business Profile is a separate consent step inside the app — and it can
          be a different Google account entirely. */}
      <p className="mt-6 text-xs text-muted">
        You&apos;ll connect your Google Business Profile after setup — it can be a
        different Google account.
      </p>
    </AuthCard>
  );
}
