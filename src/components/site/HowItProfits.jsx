import { Award } from "lucide-react";
import Container from "./Container";
import Reveal from "./Reveal";

/**
 * "How it profits" — the review submission workflow, shown as an ordered,
 * numbered card grid. Kept to the seven steps in the brief. Business value
 * and reviewer value both land here, so it doubles as the "how it works"
 * section.
 */
const STEPS = [
  { n: 1, title: "Pick a campaign", body: "Reviewers browse active campaigns and choose one that fits a product or service they've genuinely used." },
  { n: 2, title: "Open the review link", body: "One click takes them to the real listing on Google, Play Store, Trustpilot or wherever the campaign runs." },
  { n: 3, title: "Write an honest review", body: "They submit their own review externally — their words, their rating. Nothing is scripted or pre-written." },
  { n: 4, title: "Upload proof", body: "A screenshot of the posted review is uploaded as evidence of participation." },
  { n: 5, title: "AI verification", body: "The screenshot is validated by AI for authenticity — catching edits, reuse and mismatches." },
  { n: 6, title: "Admin approval", body: "A human reviewer approves or rejects, so automation never has the final say on a reward." },
];

const FINAL_STEP = { n: 7, title: "Points credited", body: "Once approved, reward points are credited for the verified participation." };

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

        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((s, i) => (
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
                  <span className="nums text-xs font-semibold text-muted">Step {s.n} of 7</span>
                </div>

                <h3 className="mt-4 text-sm font-bold text-primary">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-secondary">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </ol>

        {/* Payoff — full-width and visually distinct, since this is the
            outcome the six steps above have been building to. */}
        <Reveal delay={STEPS.length * 90} className="mt-4">
          <div className="flex flex-col items-center gap-4 rounded-card border border-accent-border bg-accent-subtle p-6 text-center shadow-sm sm:flex-row sm:text-left">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-on-brand">
              <Award className="h-5.5 w-5.5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-primary">{FINAL_STEP.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-secondary">{FINAL_STEP.body}</p>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
