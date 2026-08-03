import { ChevronDown } from "lucide-react";
import Container from "./Container";
import Reveal from "./Reveal";

/**
 * FAQ accordion built on native <details>/<summary> — open/close with zero
 * JavaScript, keyboard-accessible for free, and it works before hydration.
 *
 * FAQ_ITEMS is exported so src/app/page.jsx can emit matching FAQPage JSON-LD.
 * Keep the rendered <p> text byte-identical to the `a` string — schema that
 * disagrees with the visible answer is a manual-action risk.
 */
export const FAQ_ITEMS = [
  {
    q: "Does ReviewHub pay people to write positive reviews?",
    a: "No. Reviewers are rewarded for verified participation — submitting a genuine review and proving it — never for the rating they give. Paying for positive reviews violates Google's and Trustpilot's policies and puts the business at risk, so the platform is built so it cannot be done.",
  },
  {
    q: "Which platforms does ReviewHub support?",
    a: "Google Business Profile, Play Store, App Store, Trustpilot, AmbitionBox, Glassdoor, Amazon, Flipkart, G2 and Capterra, with more added over time. You collect and monitor all of them from one dashboard.",
  },
  {
    q: "How are reviews verified?",
    a: "Every submission requires a screenshot of the posted review. That proof is validated by AI for authenticity and then approved or rejected by a human admin before any reward is credited. Automation never has the final say.",
  },
  {
    q: "How does ReviewHub prevent fraud?",
    a: "Duplicate accounts, reused or edited screenshots, repeat reviews and suspicious behaviour are detected using device fingerprinting and IP monitoring, so campaigns aren't drained by fake activity.",
  },
  {
    q: "How do rewards and the wallet work?",
    a: "Businesses fund campaigns from a wallet. Reviewers accrue reward points for verified participation. Both sides see a transparent record of activity and spend.",
  },
  {
    q: "Is this compliant with review platform policies?",
    a: "The model rewards participation and verified feedback, not specifically positive reviews, and it never gates unhappy customers away from posting. That is the deliberate design that keeps businesses on the right side of platform rules.",
  },
];

export default function Faq() {
  return (
    // Section spacing set to the requested compact rhythm (py-8 sm:py-12)
    <section id="faq" className="border-t border-default bg-surface-sunken py-8 sm:py-12">
      <Container className="max-w-3xl">
        {/* Header Block following standard typographic system spacing */}
        <Reveal>
          <p className="text-xs font-bold uppercase tracking-widest text-accent">
            FAQS
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-primary sm:text-4xl">
            Frequently asked questions
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-secondary sm:text-base">
            Got questions about verified compliance, reward logistics, or platform verification? We've got answers.
          </p>
        </Reveal>

        {/* FAQ Accordion List using semantic dl/details */}
        <dl className="mt-10 space-y-3.5">
          {FAQ_ITEMS.map((item, i) => (
            <Reveal key={item.q} delay={i * 70}>
              <details className="group rounded-card border border-default bg-surface-raised px-5 shadow-sm transition-all duration-300 open:border-accent/40 open:shadow-md hover:border-strong/60 [&_summary]:list-none">
                {/* Summary with cursor toggle styling, text transitions, and accessible focus rings */}
                <summary className="flex cursor-pointer items-center justify-between gap-4 rounded-md py-4 font-semibold text-primary transition-colors duration-150 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 group-open:text-accent">
                  <dt className="select-none text-sm sm:text-base">{item.q}</dt>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-muted transition-all duration-300 group-open:bg-accent group-open:text-on-brand">
                    <ChevronDown
                      className="h-4 w-4 transition-transform duration-300 group-open:rotate-180"
                      aria-hidden="true"
                    />
                  </span>
                </summary>
                {/* A closed <details> doesn't render its body, so a CSS
                    transition has nothing to run from — .faq-answer is a
                    keyframe animation instead, which fires each time the
                    element appears. */}
                <dd className="faq-answer pb-5 text-sm leading-relaxed text-secondary sm:text-base">
                  {item.a}
                </dd>
              </details>
            </Reveal>
          ))}
        </dl>
      </Container>
    </section>
  );
}