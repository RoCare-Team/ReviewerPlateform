import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Clock, Newspaper } from "lucide-react";
import Container from "../../components/site/Container";
import Reveal from "../../components/site/Reveal";
import SiteHeader from "../../components/site/SiteHeader";
import SiteFooter from "../../components/site/SiteFooter";
import { getContact } from "../../lib/contact";
import { getPublishedPosts, formatPostDate } from "../../lib/blog";

const BRAND_NAME = getContact("brand.productName", "RapportLook");
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.rapportlook.com";

const TITLE = `Blog — ${BRAND_NAME}`;
const DESCRIPTION =
  "Guides on verified reviews, platform policy, and reputation management — for businesses collecting genuine customer feedback without buying ratings.";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "review verification blog",
    "Google review policy",
    "reputation management guide",
    "verified reviews",
  ],
  alternates: { canonical: "/blog" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/blog",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default async function BlogIndexPage() {
  // Published-only, from the DB — draft posts an admin is still working on
  // never reach this page. See src/lib/blog.js and /admin/blog for authoring.
  const posts = await getPublishedPosts();

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Blog",
        "@id": `${SITE_URL}/blog#blog`,
        name: TITLE,
        description: DESCRIPTION,
        url: `${SITE_URL}/blog`,
        publisher: { "@type": "Organization", name: BRAND_NAME, url: SITE_URL },
      },
      {
        "@type": "ItemList",
        itemListElement: posts.map((p, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${SITE_URL}/blog/${p.slug}`,
          name: p.title,
        })),
      },
    ],
  };

  return (
    <>
      <SiteHeader />

      <main className="bg-background">
        <section className="relative overflow-hidden border-b border-default/60 bg-surface-sunken py-16 sm:py-20">
          <div
            className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-72 w-xl -translate-x-1/2 rounded-full bg-accent/10 blur-[100px]"
            aria-hidden="true"
          />
          <Container className="max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-accent">Blog</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-primary sm:text-4xl lg:text-5xl">
              Verified reviews, done right
            </h1>
            <p className="mt-5 text-base leading-relaxed text-secondary sm:text-lg">
              Guides on review verification, platform policy, and reputation management — for
              businesses that collect genuine feedback without buying ratings.
            </p>
          </Container>
        </section>

        <section className="py-16 sm:py-20">
          <Container>
            {posts.length === 0 ? (
              <div className="mx-auto max-w-md rounded-card border border-dashed border-default bg-surface-raised p-10 text-center">
                <p className="text-sm font-semibold text-primary">Nothing published yet</p>
                <p className="mt-1 text-sm text-secondary">Check back soon for new posts.</p>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {posts.map((post, i) => (
                  <Reveal key={post.slug} delay={i * 60}>
                    <Link
                      href={`/blog/${post.slug}`}
                      className="group flex h-full flex-col overflow-hidden rounded-card border border-default bg-surface-raised shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-accent/30 hover:shadow-lg"
                    >
                      <div className="relative h-44 w-full overflow-hidden bg-surface-sunken">
                        {/* Guard against a post with no cover image (e.g. a
                            pre-migration row) — next/image throws on an empty
                            src, so this must stay conditional, not just a
                            missing alt. */}
                        {post.coverImage ? (
                          <Image
                            src={post.coverImage}
                            alt=""
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-accent-subtle text-accent">
                            <Newspaper className="h-8 w-8 opacity-40" aria-hidden="true" />
                          </div>
                        )}
                      </div>

                      <div className="flex flex-1 flex-col p-6">
                        <span className="inline-flex w-fit items-center rounded-full bg-accent-subtle px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-accent">
                          {post.category}
                        </span>
                        <h2 className="mt-4 text-lg font-bold leading-snug tracking-tight text-primary transition-colors duration-200 group-hover:text-accent">
                          {post.title}
                        </h2>
                        <p className="mt-2 flex-1 text-sm leading-relaxed text-secondary">{post.excerpt}</p>
                        <div className="mt-5 flex items-center justify-between border-t border-default/70 pt-4 text-xs font-medium text-muted">
                          <time dateTime={post.publishedAt}>{formatPostDate(post.publishedAt)}</time>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                            {post.readMinutes} min read
                          </span>
                        </div>
                        <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
                          Read article
                          <ArrowRight
                            className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1"
                            aria-hidden="true"
                          />
                        </span>
                      </div>
                    </Link>
                  </Reveal>
                ))}
              </div>
            )}
          </Container>
        </section>
      </main>

      <SiteFooter />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
