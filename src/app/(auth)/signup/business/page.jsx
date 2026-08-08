import { Suspense } from "react";
import Link from "next/link";
import AuthCard from "../../../../components/auth/AuthCard";
import PhoneOtpForm from "../../../../components/auth/PhoneOtpForm";
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
      <Suspense fallback={null}>
        <PhoneOtpForm mode="signup" role={ROLES.BUSINESS_OWNER} />
      </Suspense>

      {/* The Google Business Profile connection is a separate, later consent
          step inside the app (a different OAuth client entirely) — unrelated
          to how you sign in here. */}
      <p className="mt-6 text-xs text-muted">
        You&apos;ll connect your Google Business Profile after setup.
      </p>
    </AuthCard>
  );
}
