import {
  Award,
  Briefcase,
  ExternalLink,
  Gift,
  LayoutDashboard,
  Megaphone,
  PenLine,
  Search,
  ShieldCheck,
  Star,
  Upload,
  Users,
  Wallet,
} from "lucide-react";
import Container from "./Container";
import Reveal from "./Reveal";

/**
 * "How it works" — a graphical horizontal flow per track (business, then
 * reviewer) instead of a text list: icon nodes in circles, connected by
 * arrows, so the journey reads as a pipeline at a glance before anyone
 * reads a word. Each track scrolls sideways on narrow screens rather than
 * wrapping, so the pipeline shape never breaks.
 */
const TRACKS = [
  {
    key: "business",
    label: "For businesses",
    TrackIcon: Briefcase,
    tone: "accent",
    blurb: "Launch a campaign, fund it, and let genuine customers do the reviewing — every one of them checked before it counts.",
    steps: [
      { n: 1, Icon: Megaphone, title: "Create a campaign", body: "Pick the platform, the reward per review, and how many you need." },
      { n: 2, Icon: Wallet, title: "Fund your wallet", body: "Top up once via Razorpay — rewards pay out as reviews get approved." },
      { n: 3, Icon: Users, title: "Reviewers pick it up", body: "Goes live to reviewers who've actually used products like yours." },
      { n: 4, Icon: ShieldCheck, title: "AI + admin verification", body: "Every submission is checked by AI, then confirmed by a human." },
      { n: 5, Icon: Star, title: "Reviews go live", body: "Approved reviews land on your real Google/Play Store/Trustpilot profile." },
      { n: 6, Icon: LayoutDashboard, title: "Track it all", body: "Spend, performance and every review, in one dashboard.", isFinal: true },
    ],
  },
  {
    key: "reviewer",
    label: "For reviewers",
    TrackIcon: Star,
    tone: "verified",
    blurb: "Browse campaigns for products you've genuinely used, leave an honest review, and get rewarded once it's verified.",
    steps: [
      { n: 1, Icon: Search, title: "Pick a campaign", body: "Browse active campaigns for something you've genuinely used." },
      { n: 2, Icon: ExternalLink, title: "Open the review link", body: "One click to the real listing on Google, Play Store or Trustpilot." },
      { n: 3, Icon: PenLine, title: "Write an honest review", body: "Your own words, your rating — nothing scripted or pre-written." },
      { n: 4, Icon: Upload, title: "Upload proof", body: "A screenshot of the posted review as evidence of participation." },
      { n: 5, Icon: ShieldCheck, title: "AI verification", body: "The screenshot is validated for authenticity — no edits, no reuse." },
      { n: 6, Icon: Gift, title: "Points credited", body: "Once confirmed, reward points land in your account.", isFinal: true },
    ],
  },
];

/** Straight connector between two nodes, with an arrowhead riding its
 *  midpoint — draws itself in on scroll via the Reveal wrapper on each node. */
function Connector({ tone }) {
  const stroke = tone === "accent" ? "bg-accent/25" : "bg-verified/25";
  const arrow = tone === "accent" ? "border-accent/40 text-accent" : "border-verified/40 text-verified";
  return (
    <div className="relative flex h-16 w-10 shrink-0 items-center sm:w-14" aria-hidden="true">
      <span className={`h-0.5 w-full ${stroke}`} />
      <span
        className={`absolute left-1/2 top-1/2 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 rotate-45 items-center justify-center rounded-sm border-r-2 border-t-2 bg-surface-sunken ${arrow}`}
      />
    </div>
  );
}

function FlowNode({ step, tone }) {
  const { Icon, n, title, body, isFinal } = step;
  const solid = tone === "accent" ? "bg-accent text-on-brand shadow-lg shadow-accent/30" : "bg-verified text-on-brand shadow-lg shadow-verified/30";
  const outline =
    tone === "accent"
      ? "border-accent/30 bg-surface-raised text-accent group-hover:border-accent group-hover:bg-accent-subtle"
      : "border-verified/30 bg-surface-raised text-verified group-hover:border-verified group-hover:bg-verified-subtle";
  const badge = tone === "accent" ? "bg-accent text-on-brand" : "bg-verified text-on-brand";

  return (
    <div className="group flex w-32 shrink-0 flex-col items-center text-center sm:w-36">
      <div className="relative">
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-2xl border-2 transition-all duration-300 group-hover:-translate-y-1 sm:h-18 sm:w-18 ${
            isFinal ? solid : `${outline} border`
          }`}
        >
          <Icon className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden="true" />
        </div>
        <span
          className={`nums absolute -right-1.5 -top-1.5 flex h-5.5 w-5.5 items-center justify-center rounded-full text-[11px] font-bold ring-2 ring-surface-sunken ${
            isFinal ? "bg-primary text-on-brand" : badge
          }`}
        >
          {isFinal ? <Award className="h-3 w-3" aria-hidden="true" /> : n}
        </span>
      </div>
      <p className="mt-3 text-xs font-bold leading-snug text-primary sm:text-sm">{title}</p>
      <p className="mt-1 text-[11px] leading-snug text-muted sm:text-xs">{body}</p>
    </div>
  );
}

function FlowRow({ track }) {
  const { TrackIcon, tone, label, blurb, steps } = track;
  const chipTone = tone === "accent" ? "bg-accent-subtle text-accent" : "bg-verified-subtle text-verified";

  return (
    <div>
      <Reveal className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${chipTone}`}>
          <TrackIcon className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
        <div>
          <p className={`text-xs font-bold uppercase tracking-wide ${tone === "accent" ? "text-accent" : "text-verified"}`}>
            {label}
          </p>
          <p className="mt-0.5 max-w-xl text-sm leading-relaxed text-secondary">{blurb}</p>
        </div>
      </Reveal>

      {/* The pipeline itself — icon nodes joined by arrow connectors, scrolls
          sideways on narrow screens instead of wrapping so the flow shape
          (the whole point of drawing it this way) never breaks. */}
      <div className="scrollbar-none mt-6 overflow-x-auto pb-2 pt-3">
        <div className="flex w-max items-start px-1 pr-4 sm:pr-6">
          {steps.map((step, i) => (
            <Reveal key={step.n} delay={i * 90} className="flex items-start">
              <FlowNode step={step} tone={tone} />
              {i < steps.length - 1 && <Connector tone={tone} />}
            </Reveal>
          ))}
        </div>
      </div>
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

        <div className="mt-10 space-y-10 rounded-3xl border border-default bg-surface p-6 shadow-sm sm:p-8">
          <FlowRow track={TRACKS[0]} />
          <div className="border-t border-default" />
          <FlowRow track={TRACKS[1]} />
        </div>
      </Container>
    </section>
  );
}
