import Link from "next/link";
import AuthCard from "../../../../components/auth/AuthCard";
import SignupForm from "../../../../components/auth/SignupForm";
import GoogleSignupButton from "../../../../components/auth/GoogleSignupButton";
import { ROLES } from "../../../../lib/auth/roles";

export const metadata = {
  title: "Sign up as a reviewer · ReviewHub",
};

export default function ReviewerSignupPage() {
  return (
    <AuthCard
      title="Create a reviewer account"
      subtitle="Share honest feedback about businesses you've visited."
      footer={
        <>
          Run a business instead?{" "}
          <Link href="/signup/business" className="text-accent hover:underline">
            Sign up as a business
          </Link>
        </>
      }
    >
      <SignupForm role={ROLES.REVIEWER} />

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-default" />
        <span className="text-xs text-muted">OR</span>
        <span className="h-px flex-1 bg-default" />
      </div>

      <GoogleSignupButton role={ROLES.REVIEWER} label="Sign up with Google" />

      <p className="mt-6 text-xs text-muted">
        ReviewHub never pays for reviews and never posts on your behalf.
      </p>
    </AuthCard>
  );
}
