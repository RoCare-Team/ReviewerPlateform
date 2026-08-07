import { Mail, Clock, MapPin } from "lucide-react";
import Container from "../../components/site/Container";
import SiteHeader from "../../components/site/SiteHeader";
import SiteFooter from "../../components/site/SiteFooter";
import ContactPageForm from "../../components/site/ContactPageForm";
import { getContact } from "../../lib/contact";

const BRAND_NAME = getContact("brand.productName", "RapportLook");
const SUPPORT_EMAIL = getContact("emails.support", "info@rapportlook.com");
// Everything below is optional and TODO in most deployments (see
// data/contact.json) — getContact() already returns null for placeholders, so
// each block below only renders once the real value is filled in.
const SUPPORT_HOURS = getContact("support.hours");
const ADDRESS = getContact("addresses.registered.full");

export const metadata = {
  title: `Contact us — ${BRAND_NAME}`,
  description:
    "Get in touch with the RapportLook team — questions about verified review campaigns, pricing, or your account.",
  keywords: ["contact RapportLook", "RapportLook support"],
  alternates: { canonical: "/contact" },
  openGraph: {
    title: `Contact us — ${BRAND_NAME}`,
    description: "Get in touch with the RapportLook team.",
    url: "/contact",
  },
};

const INFO_ITEMS = [
  SUPPORT_EMAIL && { Icon: Mail, label: "Email", value: SUPPORT_EMAIL, href: `mailto:${SUPPORT_EMAIL}` },
  SUPPORT_HOURS && { Icon: Clock, label: "Support hours", value: SUPPORT_HOURS },
  ADDRESS && { Icon: MapPin, label: "Address", value: ADDRESS },
].filter(Boolean);

export default function ContactPage() {
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
          <Container className="max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-accent">Contact</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-primary sm:text-4xl lg:text-5xl">
              Get in touch
            </h1>
            <p className="mt-5 text-base leading-relaxed text-secondary sm:text-lg">
              Questions about verified review campaigns, pricing, or your account — send us a message
              and our team will get back to you.
            </p>
          </Container>
        </section>

        <section className="py-16 sm:py-20">
          <Container className="grid gap-10 lg:grid-cols-[1fr_1.3fr] lg:gap-14">
            {/* Contact info — only the fields that are actually filled in
                data/contact.json render; nothing here fabricates a detail. */}
            <div>
              <h2 className="text-xl font-bold tracking-tight text-primary">Reach us directly</h2>
              <p className="mt-2 text-sm leading-relaxed text-secondary">
                Prefer email? Reach out any time — we usually reply within a business day.
              </p>

              {INFO_ITEMS.length > 0 ? (
                <ul className="mt-6 space-y-4">
                  {INFO_ITEMS.map(({ Icon, label, value, href }) => (
                    <li key={label} className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-subtle text-accent">
                        <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
                        {href ? (
                          <a href={href} className="text-sm font-semibold text-primary hover:text-accent hover:underline">
                            {value}
                          </a>
                        ) : (
                          <p className="text-sm font-semibold text-primary">{value}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {/* Form */}
            <ContactPageForm />
          </Container>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
