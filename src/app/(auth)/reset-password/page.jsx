import { Suspense } from "react";
import AuthCard from "../../../components/auth/AuthCard";
import ResetPasswordForm from "../../../components/auth/ResetPasswordForm";

export const metadata = {
  title: "Reset password · ReviewHub",
};

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Set a new password" subtitle="Choose a password you don't use elsewhere.">
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
