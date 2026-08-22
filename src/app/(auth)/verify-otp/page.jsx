import { Suspense } from "react";
import AuthCard from "../../../components/auth/AuthCard";
import VerifyOtpForm from "../../../components/auth/VerifyOtpForm";

export const metadata = {
  title: "Verify your email · RapportLook",
  robots: { index: false, follow: false },
};

export default function VerifyOtpPage() {
  return (
    <AuthCard
      title="Check your email"
      subtitle="Enter the 6-digit code we sent you. It expires in 10 minutes."
    >
      <Suspense fallback={null}>
        <VerifyOtpForm />
      </Suspense>
    </AuthCard>
  );
}
