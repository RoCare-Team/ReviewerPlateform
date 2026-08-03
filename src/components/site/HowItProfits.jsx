import Container from "./Container";
import Reveal from "./Reveal";

/**
 * "How it profits" — the review submission workflow, shown as an ordered,
 * numbered flow. Kept to the seven steps in the brief. Business value and
 * reviewer value both land here, so it doubles as the "how it works" section.
 */
const STEPS = [
  { n: 1, title: "Pick a campaign", body: "Reviewers browse active campaigns and choose one that fits a product or service they've genuinely used." },
  { n: 2, title: "Open the review link", body: "One click takes them to the real listing on Google, Play Store, Trustpilot or wherever the campaign runs." },
  { n: 3, title: "Write an honest review", body: "They submit their own review externally — their words, their rating. Nothing is scripted or pre-written." },
  { n: 4, title: "Upload proof", body: "A screenshot of the posted review is uploaded as evidence of participation." },
  { n: 5, title: "AI verification", body: "The screenshot is validated by AI for authenticity — catching edits, reuse and mismatches." },
  { n: 6, title: "Admin approval", body: "A human reviewer approves or rejects, so automation never has the final say on a reward." },
  { n: 7, title: "Points credited", body: "Once approved, reward points are credited for the verified participation." },
];

export default function HowItProfits() {
  return (
    <section id="how-it-works" className="relative border-y border-default/40 bg-surface-sunken py-12 sm:py-16">
      <Container>
        {/* Header Block with compact, modern visual balance */}
        <Reveal className="max-w-3xl">
          <div className="flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-accent" />
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-accent">
              The Workflow
            </p>
          </div>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-primary sm:text-3xl lg:text-[2rem] lg:leading-[1.2]">
            How it works, End to End
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-secondary/95">
            Businesses get verified reviews; reviewers get rewarded for real participation. Every
            step is checked — twice.
          </p>
        </Reveal>

        {/* Process Ordered List Grid - tighter gaps for scaled typography */}
        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-6">
          {STEPS.map((s, i) => {
            const isFinalStep = s.n === 7;

            if (isFinalStep) {
              return (
                /*
                  Step 7: The payoff card. Clean full-width card with reduced padding
                  and lighter, glowing accents to cleanly frame the final outcome.
                */
                <Reveal
                  as="li"
                  key={s.n}
                  delay={120}
                  className="sm:col-span-2 lg:col-span-3"
                >
                  <div className="group relative flex flex-col overflow-hidden rounded-xl border border-accent/20 bg-accent/[0.03] p-5 shadow-sm transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-accent/40 hover:shadow-md hover:shadow-accent/[0.03] sm:flex-row sm:items-center sm:gap-5">
                    <div className="card-sheen" aria-hidden="true" />
                    
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-black text-on-brand shadow-sm transition-all duration-500 group-hover:scale-105 group-hover:shadow-accent/25">
                      {s.n}
                    </span>
                    <div className="mt-3 sm:mt-0">
                      <h3 className="text-sm font-bold text-primary">{s.title}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-secondary/90">{s.body}</p>
                    </div>
                  </div>
                </Reveal>
              );
            }

            return (
              /* Steps 1-6: Highly structured card panels with compact text */
              <Reveal as="li" key={s.n} delay={(i % 3) * 90}>
                <div className="group relative flex h-full flex-col items-start overflow-hidden rounded-xl border border-default/50 bg-surface-raised p-5 shadow-sm transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:border-accent/30 hover:shadow-md">
                  
                  {/* Oversized background texture numeral (scaled down for aesthetics) */}
                  <span
                    className="pointer-events-none absolute -right-1 -top-3 select-none text-5xl font-black leading-none text-accent/[0.04] transition-all duration-500 group-hover:text-accent/[0.08]"
                    aria-hidden="true"
                  >
                    {s.n}
                  </span>

                  {/* Compact Step Number Badge */}
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-accent/15 bg-accent/[0.06] text-xs font-bold text-accent transition-all duration-500 ease-out group-hover:bg-accent group-hover:text-on-brand group-hover:border-transparent group-hover:scale-105">
                    {s.n}
                  </span>

                  <h3 className="mt-4 text-sm font-bold text-primary transition-colors duration-300 group-hover:text-accent">
                    {s.title}
                  </h3>
                  
                  <p className="mt-2 text-xs leading-relaxed text-secondary/90">
                    {s.body}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </ol>
      </Container>
    </section>
  );
}