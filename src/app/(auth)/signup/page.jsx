import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Gift,
  Info,
  LineChart,
  MessageSquareQuote,
  ShieldCheck,
  Star,
  Wallet,
} from "lucide-react";
import AuthCard from "../../../components/auth/AuthCard";

export const metadata = {
  title: "Sign up · ReviewHub",
};

// Role picker. Each choice routes to a distinct signup page, which posts to a
// distinct endpoint. The role is carried by the URL, never by a form field.
//
// The three `perks` per option are the whole point of this screen: someone who
// doesn't yet know which account they need decides from these, not from the
// title. Keep them concrete, and keep the reviewer ones participation-framed —
// reward is for verified participation, never for positive ratings (see the
// compliance note in src/app/page.jsx).
const OPTIONS = [
  {
    href: "/signup/reviewer",
    Icon: MessageSquareQuote,
    title: "I want to leave feedback",
    body: "Share your experience with businesses you've visited.",
    perks: [
      { Icon: Star, text: "Join campaigns you actually care about" },
      { Icon: Wallet, text: "Earn points for verified participation" },
      { Icon: Gift, text: "Withdraw rewards — never paid for praise" },
    ],
  },
  {
    href: "/signup/business",
    Icon: Building2,
    title: "I run a business",
    body: "Collect feedback, monitor your Google Business Profile, and reply to reviews.",
    perks: [
      { Icon: BadgeCheck, text: "Verified reviews across 100+ platforms" },
      { Icon: LineChart, text: "One dashboard for every review you get" },
      { Icon: ShieldCheck, text: "Screenshot + AI fraud checks built in" },
    ],
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
      subtitle="First, which describes you? You can't switch an account between the two later, so pick the one that fits."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {notice ? (
        <div
          role="status"
          className="mb-5 flex items-start gap-2.5 rounded-btn border border-pending bg-pending-subtle px-3.5 py-3 text-sm leading-relaxed text-primary"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-pending" aria-hidden="true" />
          <span>{notice}</span>
        </div>
      ) : null}

      {/* Semantic list: two mutually exclusive routes, not a form — each is a
          plain link so the role stays in the URL and the page needs no JS. */}
      <ul className="space-y-3.5">
        {OPTIONS.map((o) => (
          <li key={o.href}>
            <Link
              href={o.href}
              className="group block rounded-card border border-default bg-surface p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent hover:bg-accent-subtle hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:p-5"
            >
              <div className="flex items-start gap-3.5">
                {/* Icon tile inverts to solid accent on hover, so the card the
                    pointer is on is unmistakable at a glance. */}
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-accent-border bg-accent-subtle text-accent transition-colors duration-300 group-hover:border-transparent group-hover:bg-accent group-hover:text-on-brand">
                  <o.Icon className="h-5 w-5" aria-hidden="true" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-primary">{o.title}</span>
                    <ArrowRight
                      className="h-4 w-4 shrink-0 text-accent opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-secondary">{o.body}</p>
                </div>
              </div>

              <ul className="mt-4 space-y-2 border-t border-default/60 pt-3.5">
                {o.perks.map((p) => (
                  <li key={p.text} className="flex items-center gap-2.5 text-sm text-secondary">
                    <p.Icon className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                    <span className="leading-snug">{p.text}</span>
                  </li>
                ))}
              </ul>
            </Link>
          </li>
        ))}
      </ul>

      {/* Trust line. This is the last thing read before committing to an
          account, so it restates the compliance position in one sentence. */}
      <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-muted">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          ReviewHub never pays for positive reviews and never posts on your behalf.
        </span>
      </p>
    </AuthCard>
  );
}
