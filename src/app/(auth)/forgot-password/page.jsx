import Link from "next/link";
import AuthCard from "../../../components/auth/AuthCard";
import ForgotPasswordForm from "../../../components/auth/ForgotPasswordForm";

export const metadata = {
  title: "Forgot password · ReviewHub",
};

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Forgot your password?"
      subtitle="We'll email you a link to set a new one."
      footer={
        <Link href="/login" className="text-accent hover:underline">
          Back to sign in
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
