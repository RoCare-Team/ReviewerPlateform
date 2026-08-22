import { Mail, Sparkles, Users2, Rocket, ShieldCheck } from "lucide-react";
import Container from "../../components/site/Container";
import Reveal from "../../components/site/Reveal";
import SiteHeader from "../../components/site/SiteHeader";
import SiteFooter from "../../components/site/SiteFooter";
import { getContact } from "../../lib/contact";

const BRAND_NAME = getContact("brand.productName", "RapportLook");
// data/contact.json's emails.careers is still a TODO placeholder in most
// deployments — fall back to the general support address rather than
// rendering nothing or a broken mailto.
const CAREERS_EMAIL = getContact("emails.careers") ?? getContact("emails.support", "info@rapportlook.com");

export const metadata = {
  title: `Careers — ${BRAND_NAME}`,
  description:
    "Work on a review platform built around verification, not vanity metrics. See how to reach the RapportLook team about open roles.",
  keywords: ["RapportLook careers", "jobs at RapportLook", "work at RapportLook"],
  alternates: { canonical: "/careers" },
  openGraph: {
    title: `Careers — ${BRAND_NAME}`,
    description: "Work on a review platform built around verification, not vanity metrics.",
    url: "/careers",
  },
};

const VALUES = [
  {
    Icon: ShieldCheck,
    title: "We ship what we'd defend",
    text: "Every feature has to survive the question \"would this hold up to a platform policy review?\" — that discipline shapes how we build, not just what we build.",
  },
  {
    Icon: Users2,
    title: "Small team, real ownership",
    text: "No layer of process between you and the decision. You'll ship things that matter in your first week, not your first quarter.",
  },
  {
    Icon: Rocket,
    title: "Compliance-first, not compliance-last",
    text: "We design the constraint in from day one instead of retrofitting it after a platform ban. It's a harder way to build — it's also the only way that lasts.",
  },
];

export default function CareersPage() {
  return (
    <>
      <SiteHeader />

      <main className="bg-background">
        {/* Hero band */}
        <section className="relative overflow-hidden border-b border-default/60 bg-surface-sunken py-16 sm:py-20">
          <div
            className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-accent/10 blur-[100px]"
            aria-hidden="true"
          />
          <Container className="max-w-3xl text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-accent">Careers</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-primary sm:text-4xl lg:text-5xl">
              Build a review platform worth trusting
            </h1>
            <p className="mt-5 text-base leading-relaxed text-secondary sm:text-lg">
              We&apos;re a small team working on verification, not vanity metrics — reputation tooling that
              businesses and reviewers can both actually trust.
            </p>
          </Container>
        </section>

        {/* Why work here */}
        <section className="py-16 sm:py-20">
          <Container>
            <Reveal className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">
                Why work here
              </h2>
            </Reveal>
            <div className="mt-10 grid gap-5 sm:grid-cols-3">
              {VALUES.map(({ Icon, title, text }, i) => (
                <Reveal
                  key={title}
                  delay={i * 70}
                  className="rounded-card border border-default bg-surface-raised p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-accent/30 hover:shadow-lg"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-subtle text-accent">
                    <Icon className="h-5.5 w-5.5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-primary">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-secondary">{text}</p>
                </Reveal>
              ))}
            </div>
          </Container>
        </section>

        {/* Open roles — honest empty state. No fabricated listings: nothing
            here should imply a role exists that doesn't. */}
        <section className="border-t border-default/60 bg-surface-sunken py-16 sm:py-20">
          <Container className="max-w-xl text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-subtle text-accent">
              <Sparkles className="h-6 w-6" aria-hidden="true" />
            </span>
            <h2 className="mt-5 text-xl font-bold tracking-tight text-primary sm:text-2xl">
              No open roles right now
            </h2>
            <p className="mt-3 text-base leading-relaxed text-secondary">
              We&apos;re a small team and don&apos;t have a listed opening at the moment — but we&apos;re always happy
              to hear from people who care about building this the right way. Send us a note about
              yourself and what you&apos;d want to work on.
            </p>
            <a
              href={`mailto:${CAREERS_EMAIL}`}
              className="mt-6 inline-flex items-center gap-2 rounded-btn bg-accent px-6 py-3 text-sm font-semibold text-on-brand shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-md"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              Email {CAREERS_EMAIL}
            </a>
          </Container>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
