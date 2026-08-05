import Container from "./Container";
import SiteFooter from "./SiteFooter";
import SiteHeader from "./SiteHeader";

/**
 * Shared shell for the legal pages (privacy, terms, refund). Keeps heading
 * style, spacing, and the "last updated" line consistent across all three so
 * they read as one policy set instead of three one-off pages.
 */
export default function PolicyPage({ title, updated, intro, sections }) {
  return (
    <>
      <SiteHeader />

      <main className="bg-background">
        <section className="border-b border-default/60 bg-surface-sunken py-14 sm:py-16">
          <Container className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-widest text-accent">Legal</p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-primary sm:text-4xl">
              {title}
            </h1>
            <p className="mt-4 text-sm font-semibold text-muted">Last updated: {updated}</p>
            {intro && (
              <p className="mt-5 text-base leading-relaxed text-secondary sm:text-lg">{intro}</p>
            )}
          </Container>
        </section>

        <section className="py-12 sm:py-16">
          <Container className="max-w-3xl">
            <div className="space-y-10">
              {sections.map((s) => (
                <div key={s.heading}>
                  <h2 className="text-xl font-bold tracking-tight text-primary">{s.heading}</h2>
                  <div className="mt-3 space-y-3 text-base leading-relaxed text-secondary">
                    {s.body.map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                    {s.list && (
                      <ul className="ml-5 list-disc space-y-1.5">
                        {s.list.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Container>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
