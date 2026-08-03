import { Quote, Star } from "lucide-react";
import Container from "./Container";
import Reveal from "./Reveal";

/**
 * Social proof. These are illustrative placeholders — swap for real, consented
 * quotes before launch. Do NOT add Review/AggregateRating schema here until the
 * quotes are genuine and you can stand behind the numbers: fake rating markup is
 * a manual-action risk and undercuts the whole "honest reviews" positioning.
 * Avatars are initials, not photos, to avoid stock-image face rights.
 */
const QUOTES = [
  {
    quote: "We finally see every Google and Trustpilot review in one dashboard, and the verification means we trust what we're reading. Our response time dropped from days to hours.",
    name: "Ananya Rao",
    role: "Marketing Lead, Urban Cafe Co.",
  },
  {
    quote: "The fraud checks are the real deal. Duplicate screenshots and recycled reviews get flagged before they ever reach us — that alone paid for the plan.",
    name: "Vikram Shah",
    role: "Founder, MetricLabs",
  },
  {
    quote: "As a reviewer, I like that I'm rewarded for actually participating, not for lying. Upload the proof, it gets checked, points land. Simple and fair.",
    name: "Priya Nair",
    role: "Verified reviewer",
  },
];

function Avatar({ name }) {
  const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("");
  return (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent/20 bg-accent/10 text-sm font-bold text-accent shadow-inner transition-colors duration-300 group-hover:bg-accent group-hover:text-on-brand group-hover:border-transparent"
    >
      {initials}
    </span>
  );
}

export default function Testimonials() {
  return (
    // Section spacing optimized to the requested compact rhythm (py-8 sm:py-12)
    <section id="testimonials" className="py-8 sm:py-12 bg-background">
      <Container>
        {/* Header Block to maintain typographic alignment across sections */}
        <Reveal className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-widest text-accent">
            Social Proof
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-primary sm:text-4xl lg:text-[2.5rem] lg:leading-[1.15]">
            Trusted by businesses and reviewers alike
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-secondary sm:text-lg">
            Reputation you can defend, because every review behind it was verified.
          </p>
        </Reveal>

        {/* Testimonials Grid Container */}
        <ul className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {QUOTES.map((t, i) => (
            <Reveal as="li" key={t.name} delay={i * 110}>
              <div className="group relative flex h-full flex-col overflow-hidden rounded-card border border-default/60 bg-surface-raised p-6 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-accent/40 hover:shadow-lg">
                <div className="card-sheen" aria-hidden="true" />

                {/* Watermark quote glyph — decorative depth behind the text */}
                <Quote
                  className="pointer-events-none absolute -right-3 -top-3 h-20 w-20 rotate-12 text-accent/5 transition-all duration-500 group-hover:rotate-6 group-hover:text-accent/10"
                  aria-hidden="true"
                />

                {/* Star Rating Panel (Standardized to high-trust amber colors) */}
                <div className="flex gap-0.5" aria-label="5 out of 5 stars">
                  {[0, 1, 2, 3, 4].map((s) => (
                    <Star
                      key={s}
                      className="h-4 w-4 fill-amber-400 text-amber-400 transition-transform duration-300 group-hover:scale-110"
                      style={{ transitionDelay: `${s * 40}ms` }}
                      aria-hidden="true"
                    />
                  ))}
                </div>

                {/* Quote Block with standard line spacing and elegant italic typography */}
                <blockquote className="mt-4 flex-1 text-sm italic leading-relaxed text-secondary sm:text-base">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>

                {/* User Metadata Footer with a clean separator layout */}
                <div className="mt-6 flex items-center gap-3 border-t border-default/50 pt-4">
                  <Avatar name={t.name} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-primary">{t.name}</div>
                    <div className="truncate text-xs text-muted">{t.role}</div>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </ul>
      </Container>
    </section>
  );
}