import { Suspense } from "react";
import LoginForm from "../../../components/auth/LoginForm";
import AuthCard from "../../../components/auth/AuthCard";

export const metadata = {
  title: "Admin sign-in · ReviewHub",
  // Keep the admin surface out of search results.
  robots: { index: false, follow: false },
};

/**
 * Admin login. Deliberately NOT inside the (auth) route group — admin is its own
 * segment with its own login and no signup route anywhere.
 *
 * ★ NO GoogleButton HERE. roles.json gives admin auth:["credentials"] and
 * config.js rejects an admin arriving via Google, so a button would be dead —
 * but it would also advertise a door that must not exist. An admin account must
 * not be reachable through a Google compromise.
 *
 * ★ DEV ONLY — TOTP was switched off by request; see data/roles.json. Password is
 * currently the single factor on this door. Restore `requireTotp` here and
 * totp:true in roles.json before this reaches real data.
 */
export default function AdminLoginPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface-sunken px-4 py-12">
      <div className="mb-8 text-center">
        <div className="text-xl font-semibold tracking-tight text-primary">ReviewHub</div>
        <div className="mt-1 text-xs uppercase tracking-widest text-muted">Administration</div>
      </div>

      <AuthCard title="Admin sign-in" subtitle="Enter your password to continue.">
        <Suspense fallback={null}>
          <LoginForm scope="admin" />
        </Suspense>
      </AuthCard>
    </div>
  );
}
