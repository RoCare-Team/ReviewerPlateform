import Container from "./Container";

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
    <section id="how-it-works" className="border-y border-default/60 bg-surface-sunken py-8 sm:py-12">
      <Container>
        {/* Header Block with precise typographic pacing */}
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-widest text-accent">
            The Workflow
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-primary sm:text-4xl lg:text-[2.5rem] lg:leading-[1.15]">
            How it works, End to End
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-secondary sm:text-lg">
            Businesses get verified reviews; reviewers get rewarded for real participation. Every
            step is checked — twice.
          </p>
        </div>

        {/* Process Ordered List Grid */}
        <ol className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((s) => {
            const isFinalStep = s.n === 7;

            if (isFinalStep) {
              return (
                /* 
                  Step 7: The payoff card. Spans the full width of the grid columns on tablet/desktop, 
                  utilizing a distinct soft-brand background color scheme to highlight the final outcome.
                */
                <li 
                  key={s.n} 
                  className="relative rounded-card border border-accent/25 bg-accent/5 p-6 shadow-sm transition-all duration-300 hover:border-accent/40 hover:shadow-md sm:col-span-2 lg:col-span-3 flex flex-col sm:flex-row sm:items-center sm:gap-6"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-on-brand text-lg font-black shadow-md">
                    {s.n}
                  </span>
                  <div className="mt-4 sm:mt-0">
                    <h3 className="text-lg font-bold text-primary">{s.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-secondary">{s.body}</p>
                  </div>
                </li>
              );
            }

            return (
              /* Steps 1-6: Clean, highly structured sequence panels */
              <li 
                key={s.n} 
                className="relative flex flex-col items-start rounded-card border border-default bg-surface-raised p-6 shadow-sm transition-all duration-300 hover:border-strong hover:shadow-md"
              >
                {/* Visual Step Number Identifier */}
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 border border-accent/25 text-sm font-extrabold text-accent">
                  {s.n}
                </span>
                
                <h3 className="mt-5 text-base font-bold text-primary">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-secondary">{s.body}</p>
              </li>
            );
          })}
        </ol>
      </Container>
    </section>
  );
}