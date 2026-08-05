import {
  BarChart3,
  BadgeCheck,
  Gift,
  ShieldAlert,
  Wallet,
  Layers,
} from "lucide-react";
import Container from "./Container";
import Reveal from "./Reveal";

/**
 * Key features grid ("services"). Icons are imported directly — this is a server
 * component with no client boundary to cross, so a component reference is fine
 * here (unlike AppShell, where nav crosses server→client and must use string
 * keys).
 *
 * "Reward System" copy stays participation-framed on purpose; see the compliance
 * note in src/app/page.jsx.
 */
const FEATURES = [
  {
    Icon: Layers,
    title: "Multi-platform reviews",
    body: "One place to collect and monitor reviews across Google, Play Store, App Store, Trustpilot, AmbitionBox, Glassdoor, Amazon, Flipkart, G2 and Capterra.",
  },
  {
    Icon: BadgeCheck,
    title: "Verified review tracking",
    body: "Every submission is checked with screenshot proof and AI-powered validation before it counts — no self-reported honour system.",
  },
  {
    Icon: Gift,
    title: "Reward system",
    body: "Reviewers earn points for verified participation, not for positive ratings. Points are tied to genuine, checked activity.",
  },
  {
    Icon: ShieldAlert,
    title: "Fraud prevention",
    body: "Duplicate accounts, fake screenshots, repeat reviews and suspicious activity are caught with device fingerprinting and IP monitoring.",
  },
  {
    Icon: BarChart3,
    title: "Analytics dashboard",
    body: "Track review growth, campaign performance, platform-wise results and cost per review in real time.",
  },
  {
    Icon: Wallet,
    title: "Wallet system",
    body: "Businesses fund campaigns from a wallet; reviewers accrue reward points for verified work. Transparent on both sides.",
  },
];

export default function Services() {
  return (
    // scroll-mt: keeps this heading clear of the sticky header on a #features jump.
    <section
      id="features"
      className="relative scroll-mt-28 py-8 sm:py-10 sm:scroll-mt-32 bg-background overflow-hidden"
    >
      {/* Ambient background decoration for a subtle modern aesthetic */}
      <div 
        className="absolute top-0 right-1/4 -z-10 h-[350px] w-[600px] rounded-full bg-accent/5 blur-[120px] pointer-events-none select-none" 
        aria-hidden="true" 
      />

      <Container>
        {/* Header Block with balanced spacing */}
        <Reveal className="max-w-3xl">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
            <p className="text-xs font-bold uppercase tracking-wider text-accent">
              Features & Capabilities
            </p>
          </div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-primary sm:text-4xl lg:text-[2.5rem] lg:leading-[1.15]">
            Everything you need to grow reputation the honest way
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-secondary sm:text-lg">
            A full toolkit for review collection, verification, and rewards—built so it cannot 
            be used to buy or fake a single star.
          </p>
        </Reveal>

        {/* Features Grid: Responsive structure with refined gaps */}
        <ul className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {FEATURES.map(({ Icon, title, body }, i) => (
            // Staggered delay for seamless progressive entry
            <Reveal as="li" key={title} delay={(i % 3) * 90}>
              <div className="group relative h-full overflow-hidden rounded-2xl border border-default/50 bg-surface-raised p-6 sm:p-8 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1.5 hover:border-accent/30 hover:shadow-xl hover:shadow-accent/[0.02]">
                
                {/* Micro-interaction: Radial ambient card spotlight glow */}
                <div 
                  className="absolute inset-0 bg-gradient-to-br from-accent/[0.03] via-transparent to-transparent opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100 pointer-events-none" 
                  aria-hidden="true" 
                />
                
                <div className="card-sheen" aria-hidden="true" />

                {/* Icon Container: Fluid inversion on card hover */}
                <div className="relative inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent/[0.08] border border-accent/20 text-accent transition-all duration-500 ease-out group-hover:bg-accent group-hover:text-on-brand group-hover:border-transparent group-hover:scale-105 group-hover:shadow-md group-hover:shadow-accent/20">
                  <Icon
                    className="h-5 w-5 transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-110 group-hover:-rotate-3"
                    aria-hidden="true"
                  />
                </div>

                {/* Title links with smooth highlight style */}
                <h3 className="relative mt-6 text-lg font-bold text-primary transition-colors duration-300 group-hover:text-accent">
                  {title}
                </h3>

                {/* Body copy */}
                <p className="relative mt-3 text-sm leading-relaxed text-secondary/90 transition-colors duration-300 group-hover:text-secondary">
                  {body}
                </p>
              </div>
            </Reveal>
          ))}
        </ul>
      </Container>
    </section>
  );
}