import Link from "next/link";
import AuthCard from "../../../components/auth/AuthCard";

export const metadata = {
  title: "Sign up · ReviewHub",
};

// Role picker. Each choice routes to a distinct signup page, which posts to a
// distinct endpoint. The role is carried by the URL, never by a form field.
const OPTIONS = [
  {
    href: "/signup/reviewer",
    title: "I want to leave feedback",
    body: "Share your experience with businesses you've visited.",
  },
  {
    href: "/signup/business",
    title: "I run a business",
    body: "Collect feedback, monitor your Google Business Profile, and reply to reviews.",
  },
];

export default async function SignupPage({ searchParams }) {
  const params = await searchParams;

  // Landed here from the Google flow with no account and no signup intent —
  // config.js can't guess a role, so it sent them to choose one.
  const notice =
    params?.e === "choose_role"
      ? "Almost there — tell us which kind of account you need, then continue with Google."
      : null;

  return (
    <AuthCard
      title="Create your account"
      subtitle="First, which describes you?"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {notice ? (
        <div className="mb-4 rounded-btn border border-pending bg-pending-subtle px-3 py-2 text-sm text-primary">
          {notice}
        </div>
      ) : null}

      <div className="space-y-3">
        {OPTIONS.map((o) => (
          <Link
            key={o.href}
            href={o.href}
            className="block rounded-card border border-default bg-surface p-4 transition hover:border-accent-border hover:bg-accent-subtle"
          >
            <div className="font-medium text-primary">{o.title}</div>
            <div className="mt-1 text-sm text-secondary">{o.body}</div>
          </Link>
        ))}
      </div>
    </AuthCard>
  );
}
