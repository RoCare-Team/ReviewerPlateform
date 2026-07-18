import Container from "./Container";

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
    <section className="py-8 sm:py-12 bg-background/50">
      <Container>
        <dl className="grid grid-cols-2 gap-y-10 gap-x-6 rounded-card border border-default bg-surface-raised p-8 sm:p-12 lg:grid-cols-4 lg:gap-x-0 lg:p-10 shadow-sm backdrop-blur-sm">
          {STATS.map(({ value, label }, index) => (
            <div 
              key={label} 
              className={`flex flex-col items-center text-center px-4 ${
                index !== 0 ? "lg:border-l lg:border-default/60" : ""
              }`}
            >
              {/* Stat value: Transitioned to extrabold + tight tracking for high visual authority */}
              <dt className="text-4xl font-extrabold tracking-tight text-accent sm:text-5xl lg:text-[3.25rem]">
                {value}
              </dt>
              {/* Stat label: Constrained max-width for balanced multi-line text wraps */}
              <dd className="mt-3 max-w-[200px] text-xs font-semibold leading-relaxed text-secondary sm:text-sm">
                {label}
              </dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}