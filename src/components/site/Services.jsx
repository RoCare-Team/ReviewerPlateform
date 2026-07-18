import {
  BarChart3,
  BadgeCheck,
  Gift,
  ShieldAlert,
  Wallet,
  Layers,
} from "lucide-react";
import Container from "./Container";

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
    <section id="features" className="py-8 sm:py-12 bg-background">
      <Container>
        {/* Header Block with cleaner structural pacing */}
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-widest text-accent">
            Features & Capabilities
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-primary sm:text-4xl lg:text-[2.5rem] lg:leading-[1.15]">
            Everything you need to grow reputation the honest way
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-secondary sm:text-lg">
            A full toolkit for review collection, verification and reward — built so it can&rsquo;t
            be used to buy or fake a single star.
          </p>
        </div>

        {/* Features Grid: Slightly wider gap on large displays for breathing room */}
        <ul className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {FEATURES.map(({ Icon, title, body }) => (
            <li
              key={title}
              className="group rounded-card border border-default/60 bg-surface-raised p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-strong hover:shadow-md"
            >
              {/* Icon Container: Inverts background color on card hover */}
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 border border-accent/25 text-accent transition-colors duration-300 group-hover:bg-accent group-hover:text-on-brand group-hover:border-transparent">
                <Icon className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" aria-hidden="true" />
              </div>
              
              {/* Title links with dynamic hover style */}
              <h3 className="mt-5 text-lg font-bold text-primary group-hover:text-accent transition-colors duration-200">
                {title}
              </h3>
              
              <p className="mt-2.5 text-sm leading-relaxed text-secondary">
                {body}
              </p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}