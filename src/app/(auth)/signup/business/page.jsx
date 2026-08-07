import Link from "next/link";
import AuthCard from "../../../../components/auth/AuthCard";
import SignupForm from "../../../../components/auth/SignupForm";
import GoogleSignupButton from "../../../../components/auth/GoogleSignupButton";
import { ROLES } from "../../../../lib/auth/roles";

const TITLE = "Sign up your business · RapportLook";
const DESCRIPTION =
  "Collect verified customer reviews across Google, Trustpilot, Play Store and more. Create a free RapportLook business account.";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: ["business review signup", "collect verified reviews", "review management signup"],
  alternates: { canonical: "/signup/business" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/signup/business" },
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
