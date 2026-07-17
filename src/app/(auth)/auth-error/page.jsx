import Link from "next/link";
import AuthCard from "../../../components/auth/AuthCard";

export const metadata = {
  title: "Sign-in problem · ReviewHub",
};

/**
 * Where OAuth failures land. Messages are deliberately vague about whether an
 * account exists — this page is reachable unauthenticated, so it must not become
 * an enumeration oracle either.
 */
const MESSAGES = {
  unverified_google: {
    title: "Google couldn't verify that email",
    body: "Your Google account's email address isn't verified, so we can't use it to sign you in. Verify it with Google, or sign in with a password instead.",
  },
  verify_email_first: {
    title: "Verify your email first",
    body: "There's already an account with this email that hasn't been verified. Verify it by email before connecting Google, so we know the account is yours.",
    action: { href: "/verify-otp", label: "Verify by email" },
  },
  oauth_not_allowed: {
    title: "Use your password to sign in",
    body: "This account can't sign in with Google. Use your email and password.",
  },
  suspended: {
    title: "Account suspended",
    body: "This account has been suspended. Contact support if you think that's a mistake.",
  },
  Configuration: {
    title: "Sign-in is temporarily unavailable",
    body: "Something's misconfigured on our side. Please try again shortly.",
  },
};

const FALLBACK = {
  title: "We couldn't sign you in",
  body: "Something went wrong during sign-in. Please try again.",
};

export default async function AuthErrorPage({ searchParams }) {
  const params = await searchParams;
  // `e` is ours; `error` is what Auth.js appends.
  const key = params?.e ?? params?.error;
  const msg = MESSAGES[key] ?? FALLBACK;

  return (
    <AuthCard
      title={msg.title}
      subtitle={msg.body}
      footer={
        <Link href="/login" className="text-accent hover:underline">
          Back to sign in
        </Link>
      }
    >
      {msg.action ? (
        <Link
          href={msg.action.href}
          className="block w-full rounded-btn bg-accent px-4 py-2.5 text-center font-medium text-on-brand transition hover:bg-accent-hover"
        >
          {msg.action.label}
        </Link>
      ) : (
        <Link
          href="/login"
          className="block w-full rounded-btn bg-accent px-4 py-2.5 text-center font-medium text-on-brand transition hover:bg-accent-hover"
        >
          Try again
        </Link>
      )}
    </AuthCard>
  );
}
