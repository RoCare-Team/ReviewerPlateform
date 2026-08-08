import { Suspense } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import AuthCard from "../../../../components/auth/AuthCard";
import PhoneOtpForm from "../../../../components/auth/PhoneOtpForm";
import { ROLES } from "../../../../lib/auth/roles";

const TITLE = "Sign up as a reviewer · RapportLook";
const DESCRIPTION =
  "Join campaigns and get rewarded for verified participation — never for a positive rating. Create a free RapportLook reviewer account.";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: ["reviewer signup", "get paid for reviews", "verified reviewer rewards"],
  alternates: { canonical: "/signup/reviewer" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/signup/reviewer" },
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
      <Suspense fallback={null}>
        <PhoneOtpForm mode="signup" role={ROLES.REVIEWER} />
      </Suspense>

      <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-muted">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>RapportLook never pays for reviews and never posts on your behalf.</span>
      </p>
    </AuthCard>
  );
}
