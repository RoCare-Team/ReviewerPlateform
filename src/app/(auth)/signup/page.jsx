import Link from "next/link";
import { ArrowRight, Building2, Info, MessageSquareQuote } from "lucide-react";
import AuthCard from "../../../components/auth/AuthCard";
import CrossRoleRedirect from "../../../components/auth/CrossRoleRedirect";

export const metadata = {
  title: "Sign up · ReviewHub",
};

// Role picker. Each choice routes to a distinct signup page, which posts to a
// distinct endpoint. The role is carried by the URL, never by a form field.
// Icon + title only — no explanation needed, the two titles already say it.
const OPTIONS = [
  { href: "/signup/reviewer", Icon: MessageSquareQuote, title: "I want to leave feedback" },
  { href: "/signup/business", Icon: Building2, title: "I run a business" },
];

const ROLE_LABEL = { reviewer: "reviewer", business_owner: "business" };

export default async function SignupPage({ searchParams }) {
  const params = await searchParams;

  // Landed here from the Google flow with no account and no signup intent —
  // config.js can't guess a role, so it sent them to choose one.
  const notice =
    params?.e === "choose_role"
      ? "Almost there — tell us which kind of account you need, then continue with Google."
      : null;

  // Google flow blocked in config.js: this email already has an account under
  // the OTHER role. Toast + auto-redirect to /login instead of the static
  // inline notice above — this one needs to actually move the user along.
  const crossRoleLabel =
    params?.e === "cross_role" ? (ROLE_LABEL[params.role] ?? "different") : null;

  return (
    <AuthCard
      title="Create your account"
      subtitle="Pick one — it can't be switched later."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {crossRoleLabel && (
        <CrossRoleRedirect
          message={`You already have a ${crossRoleLabel} account with this email. Redirecting to login…`}
        />
      )}

      {notice ? (
        <div
          role="status"
          className="mb-5 flex items-start gap-2.5 rounded-btn border border-pending bg-pending-subtle px-3.5 py-3 text-sm leading-relaxed text-primary"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-pending" aria-hidden="true" />
          <span>{notice}</span>
        </div>
      ) : null}

      {/* Two mutually exclusive routes, not a form — each is a plain link so
          the role stays in the URL and the page needs no JS. */}
      <div className="space-y-3">
        {OPTIONS.map((o) => (
          <Link
            key={o.href}
            href={o.href}
            className="group flex items-center gap-4 rounded-card border border-default bg-surface p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent hover:bg-accent-subtle hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:p-5"
          >
            {/* Icon tile inverts to solid accent on hover, so the card the
                pointer is on is unmistakable at a glance. */}
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-accent-border bg-accent-subtle text-accent transition-all duration-300 group-hover:scale-110 group-hover:border-transparent group-hover:bg-accent group-hover:text-on-brand">
              <o.Icon className="h-5.5 w-5.5" aria-hidden="true" />
            </span>

            <span className="min-w-0 flex-1 font-bold text-primary">{o.title}</span>

            <ArrowRight
              className="h-4 w-4 shrink-0 text-accent opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-100"
              aria-hidden="true"
            />
          </Link>
        ))}
      </div>
    </AuthCard>
  );
}
