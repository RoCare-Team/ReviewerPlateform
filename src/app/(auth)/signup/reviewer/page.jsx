import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import AuthCard from "../../../../components/auth/AuthCard";
import SignupForm from "../../../../components/auth/SignupForm";
import GoogleSignupButton from "../../../../components/auth/GoogleSignupButton";
import { ROLES } from "../../../../lib/auth/roles";

export const metadata = {
  title: "Sign up as a reviewer · RapportLook",
};

export default function ReviewerSignupPage() {
  return (
    <AuthCard
      title="Create a reviewer account"
      subtitle="Share honest feedback about businesses you've visited."
      footer={
        <>
          Run a business instead?{" "}
          <Link href="/signup/business" className="font-semibold text-accent hover:underline">
            Sign up as a business
          </Link>
        </>
      }
    >
      <SignupForm role={ROLES.REVIEWER} />

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-default" />
        <span className="text-xs font-semibold uppercase tracking-widest text-muted">or</span>
        <span className="h-px flex-1 bg-default" />
      </div>

      <GoogleSignupButton role={ROLES.REVIEWER} label="Sign up with Google" />

      <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-muted">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>RapportLook never pays for reviews and never posts on your behalf.</span>
      </p>
    </AuthCard>
  );
}
