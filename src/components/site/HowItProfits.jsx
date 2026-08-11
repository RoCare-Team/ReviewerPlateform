import { Award, Briefcase, Star } from "lucide-react";
import Container from "./Container";
import Reveal from "./Reveal";

/**
 * "How it works" — two separate workflows, stacked as their own sections,
 * since a business owner and a reviewer experience this platform completely
 * differently (one funds and launches campaigns, the other completes and
 * gets paid for reviews). Each gets its own numbered-card block rather than
 * being folded behind a tab switch, so both are visible on a scroll-through.
 */
const TRACKS = [
  {
    key: "business",
    label: "For businesses",
    Icon: Briefcase,
    blurb: "Launch a campaign, fund it, and let genuine customers do the reviewing — every one of them checked before it counts.",
    steps: [
      { n: 1, title: "Create a campaign", body: "Set the platform (Google, Play Store, Trustpilot…), the reward per review, and how many you need." },
      { n: 2, title: "Fund your wallet", body: "Top up once via Razorpay — rewards are paid out from this balance as reviews get approved." },
      { n: 3, title: "Reviewers pick it up", body: "Your campaign goes live to reviewers who've actually used products like yours." },
      { n: 4, title: "AI + admin verification", body: "Every submission is checked by AI for authenticity, then confirmed by a human before it's approved." },
      { n: 5, title: "Reviews land on your listing", body: "Approved reviews are real, live reviews on your actual Google/Play Store/Trustpilot profile." },
    ],
    final: { n: 6, title: "Track it all from your dashboard", body: "See campaign performance, spend, and every review in one place — reply to them directly, or turn on AI auto-reply." },
  },
  {
    key: "reviewer",
    label: "For reviewers",
    Icon: Star,
    blurb: "Browse campaigns for products you've genuinely used, leave an honest review, and get rewarded once it's verified.",
    steps: [
      { n: 1, title: "Pick a campaign", body: "Browse active campaigns and choose one that fits a product or service you've genuinely used." },
      { n: 2, title: "Open the review link", body: "One click takes you to the real listing on Google, Play Store, Trustpilot or wherever the campaign runs." },
      { n: 3, title: "Write an honest review", body: "Submit your own review externally — your words, your rating. Nothing is scripted or pre-written." },
      { n: 4, title: "Upload proof", body: "A screenshot of the posted review is uploaded as evidence of participation." },
      { n: 5, title: "AI verification", body: "The screenshot is validated by AI for authenticity — catching edits, reuse and mismatches." },
    ],
    final: { n: 6, title: "Points credited", body: "Once an admin confirms it, reward points are credited for the verified participation." },
  },
];

function Track({ track, badge }) {
  const stepCount = track.steps.length + 1;
  return (
    <div>
      <Reveal className="max-w-3xl">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-accent-subtle px-3 py-1">
          <track.Icon className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          <p className="text-xs font-bold uppercase tracking-wide text-accent">{track.label}</p>
        </div>
        <h3 className="mt-4 text-xl font-bold tracking-tight text-primary sm:text-2xl">{badge}</h3>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-secondary">{track.blurb}</p>
      </Reveal>

      <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {track.steps.map((s, i) => (
          <Reveal as="li" key={s.n} delay={(i % 3) * 90} className="h-full">
            <div className="group relative flex h-full flex-col overflow-hidden rounded-card border border-default bg-surface-raised p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-lg">
              {/* Top rail — fills in on hover, a quieter progress cue than a
                  giant background numeral. */}
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-accent transition-transform duration-300 group-hover:scale-x-100"
              />

              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-subtle text-sm font-bold text-accent transition-all duration-300 group-hover:bg-accent group-hover:text-on-brand">
                  {s.n}
                </span>
                <span className="nums text-xs font-semibold text-muted">Step {s.n} of {stepCount}</span>
              </div>

              <h3 className="mt-4 text-sm font-bold text-primary">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-secondary">{s.body}</p>
            </div>
          </Reveal>
        ))}

        {/* Payoff — fills the last grid slot instead of a separate full-width
            banner below, so the grid ends flush and there's no empty gap. */}
        <Reveal as="li" delay={track.steps.length * 90} className="h-full">
          <div className="flex h-full flex-col justify-center gap-3 rounded-card border border-accent-border bg-accent-subtle p-5 shadow-sm">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-on-brand">
              <Award className="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-primary">{track.final.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-secondary">{track.final.body}</p>
            </div>
          </div>
        </Reveal>
      </ol>
    </div>
  );
}

export default function HowItProfits() {
  // scroll-mt: the header is sticky and floats over the top of the page, so a
  // plain #how-it-works jump lands with this heading tucked behind it — the
  // offset keeps the section clear of the header on landing.
  return (
    <section
      id="how-it-works"
      className="scroll-mt-28 border-y border-default bg-surface-sunken py-12 sm:py-16 sm:scroll-mt-32"
    >
      <Container>
        <Reveal className="max-w-3xl">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-accent-subtle px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
            <p className="text-xs font-bold uppercase tracking-wide text-accent">The workflow</p>
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-primary sm:text-3xl">
            How it works, end to end
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-secondary">
            Businesses get verified reviews; reviewers get rewarded for real participation. Every
            step is checked — twice.
          </p>
        </Reveal>

        <div className="mt-10 border-t border-default pt-10">
          <Track track={TRACKS[0]} badge="For business owners" />
        </div>
        <div className="border-t border-default pt-10">
          <Track track={TRACKS[1]} badge="For reviewers" />
        </div>
      </Container>
    </section>
  );
}
