import Container from "./Container";
import Reveal from "./Reveal";

/**
 * Social-proof stat band. Numbers are framed around VERIFIED participation, not
 * raw review counts, to stay on the compliance line in src/app/page.jsx — we
 * never imply volume of positive ratings, only checked activity and coverage.
 */
const STATS = [
  { value: "10+", label: "Review platforms in one dashboard" },
  { value: "100%", label: "Submissions screenshot-verified before they count" },
  { value: "50k+", label: "Verified participations processed" },
  { value: "<2 min", label: "To launch your first campaign" },
];

export default function Stats() {
  return (
    // Section spacing optimized to the requested compact grid rhythm
    <section className="py-8 sm:py-10 bg-background/50">
      <Container>
        <Reveal
          as="dl"
          className="relative grid grid-cols-2 gap-y-10 gap-x-6 overflow-hidden rounded-card border border-default bg-surface-raised p-8 shadow-sm backdrop-blur-sm sm:p-12 lg:grid-cols-4 lg:gap-x-0 lg:p-10"
        >
          {/* Soft accent wash so the band reads as one panel, not four columns */}
          <div
            className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-56 w-xl -translate-x-1/2 rounded-full bg-accent/10 blur-[90px]"
            aria-hidden="true"
          />

          {STATS.map(({ value, label }, index) => (
            <div
              key={label}
              className={`group flex flex-col items-center px-4 text-center ${
                index !== 0 ? "lg:border-l lg:border-default/60" : ""
              }`}
            >
              {/* Stat value: Transitioned to extrabold + tight tracking for high visual authority */}
              <dt className="nums text-4xl font-bold tracking-tight text-accent transition-transform duration-300 group-hover:scale-110 sm:text-5xl lg:text-[3.25rem]">
                {value}
              </dt>
              {/* Stat label: Constrained max-width for balanced multi-line text wraps */}
              <dd className="mt-3 max-w-50 text-xs font-semibold leading-relaxed text-secondary transition-colors duration-300 group-hover:text-primary sm:text-sm">
                {label}
              </dd>
            </div>
          ))}
        </Reveal>
      </Container>
    </section>
  );
}