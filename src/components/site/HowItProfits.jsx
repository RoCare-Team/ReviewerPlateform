import { Award, Briefcase, ChevronRight, Star } from "lucide-react";
import Container from "./Container";
import Reveal from "./Reveal";

/**
 * "How it works" — one section, two side-by-side tracks (business left,
 * reviewer right) since both sides of the same transaction are easiest to
 * compare when they're visible at once rather than requiring a scroll past
 * one to reach the other. Each track is a compact vertical timeline so both
 * columns stay readable at any viewport width; they stack on mobile.
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

/**
 * Experiment: instead of two parallel columns, interleave the two tracks
 * into one center timeline — business step 1, reviewer step 1, business
 * step 2, reviewer step 2… Zigzagging left/right per card so each side
 * still reads as "whose step is this" at a glance via color + tag, but the
 * two journeys are told as one interwoven story down the middle.
 */
function interleave(a, b) {
  const out = [];
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    if (a[i]) out.push({ ...a[i], track: "business" });
    if (b[i]) out.push({ ...b[i], track: "reviewer" });
  }
  return out;
}

function InterleavedTimeline() {
  const business = [...TRACKS[0].steps, TRACKS[0].final];
  const reviewer = [...TRACKS[1].steps, TRACKS[1].final];
  const items = interleave(business, reviewer);

  return (
    <ol>
      {items.map((item, i) => {
        const isBusiness = item.track === "business";
        const isFinal = item.n === 6;
        const TrackIcon = isBusiness ? Briefcase : Star;

        return (
          <Reveal as="li" key={`${item.track}-${item.n}`} delay={i * 45}>
            {/* No card box — a numbered row with a left accent bar that grows
                in on hover, and the whole row nudges right. Reads like an
                editorial step list rather than a grid of tiles. */}
            <div
              className={`group relative flex items-start gap-5 border-b border-default py-5 transition-all duration-300 hover:pl-3 ${
                i === items.length - 1 ? "border-b-0" : ""
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute -left-4 top-0 h-full w-0.5 origin-top scale-y-0 transition-transform duration-300 ease-out group-hover:scale-y-100 ${
                  isBusiness ? "bg-accent" : "bg-verified"
                }`}
              />

              {/* Big outline numeral — the visual anchor instead of a boxed
                  badge; fills solid on hover for the "step is active" cue. */}
              <span
                className={`nums shrink-0 select-none text-3xl font-black leading-none tracking-tight transition-colors duration-300 sm:text-4xl ${
                  isFinal
                    ? isBusiness
                      ? "text-accent"
                      : "text-verified"
                    : isBusiness
                      ? "text-accent/25 group-hover:text-accent"
                      : "text-verified/25 group-hover:text-verified"
                }`}
              >
                {isFinal ? <Award className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden="true" /> : String(item.n).padStart(2, "0")}
              </span>

              <div className="min-w-0 flex-1">
                <span
                  className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide ${
                    isBusiness ? "text-accent" : "text-verified"
                  }`}
                >
                  <TrackIcon className="h-3 w-3" aria-hidden="true" />
                  {isBusiness ? "Business" : "Reviewer"}
                </span>
                <h4 className="mt-1 text-base font-bold tracking-tight text-primary sm:text-lg">{item.title}</h4>
                <p className="mt-1 max-w-xl text-sm leading-relaxed text-secondary">{item.body}</p>
              </div>

              <ChevronRight
                aria-hidden="true"
                className={`mt-1 hidden h-5 w-5 shrink-0 -translate-x-1 text-muted opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 sm:block ${
                  isBusiness ? "group-hover:text-accent" : "group-hover:text-verified"
                }`}
              />
            </div>
          </Reveal>
        );
      })}
    </ol>
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

        {/* Legend — replaces the two separate per-track intros now that both
            journeys share one timeline; a quick key for which color/tag is
            which side. */}
        <Reveal className="mt-6 flex flex-wrap gap-4">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-secondary">
            <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden="true" />
            Business owner steps
          </span>
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-secondary">
            <span className="h-2.5 w-2.5 rounded-full bg-verified" aria-hidden="true" />
            Reviewer steps
          </span>
        </Reveal>

        <div className="mt-6 rounded-3xl border border-default bg-surface-sunken/60 p-4 shadow-sm sm:p-8">
          <InterleavedTimeline />
        </div>
      </Container>
    </section>
  );
}
