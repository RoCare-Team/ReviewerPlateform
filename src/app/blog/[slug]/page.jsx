import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Calendar, Clock, User } from "lucide-react";
import Container from "../../../components/site/Container";
import SiteHeader from "../../../components/site/SiteHeader";
import SiteFooter from "../../../components/site/SiteFooter";
import { getContact } from "../../../lib/contact";
import { getPublishedPostBySlug, getRelatedPosts, formatPostDate } from "../../../lib/blog";
import { sanitizeContentHtml } from "../../../lib/blog-content";

const BRAND_NAME = getContact("brand.productName", "RapportLook");
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.rapportlook.com";

// No generateStaticParams: posts are authored at runtime from /admin/blog, not
// known at build time. Next renders each slug on first request and caches it
// (dynamicParams defaults to true) — the admin API routes call
// revalidatePath() on publish/edit/delete so that cache never goes stale.

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) return {};

  const url = `${SITE_URL}/blog/${post.slug}`;

  return {
    title: `${post.title} — ${BRAND_NAME}`,
    description: post.description,
    keywords: post.tags,
    authors: [{ name: post.author }],
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url,
      images: post.coverImage ? [{ url: post.coverImage }] : undefined,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      authors: [post.author],
      tags: post.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: post.coverImage ? [post.coverImage] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }) {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) notFound();

  const related = await getRelatedPosts(slug, post.category);
  const url = `${SITE_URL}/blog/${post.slug}`;
  // Sanitized again at render — see the note on BlogPost.content in the model.
  const safeContent = sanitizeContentHtml(post.content);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": `${url}#article`,
        headline: post.title,
        description: post.description,
        image: post.coverImage || undefined,
        url,
        datePublished: post.publishedAt,
        dateModified: post.updatedAt,
        author: { "@type": "Organization", name: post.author },
        publisher: { "@type": "Organization", name: BRAND_NAME, url: SITE_URL },
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        keywords: post.tags.join(", "),
        articleSection: post.category,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Blog", item: `${SITE_URL}/blog` },
          { "@type": "ListItem", position: 2, name: post.title, item: url },
        ],
      },
    ],
  };

  return (
    <>
      <SiteHeader />

      <main className="bg-background">
        <article>
          {/* Hero — cover image inset to the same max-w-7xl + edge padding as
              the navbar (Container's default), so its left/right edges line
              up with the header pill above instead of bleeding to the true
              viewport edge. Title card floats on top, same width as the
              article body below it. */}
          <section className="relative">
            <Container className="pt-4 sm:pt-6">
              <div className="relative h-64 w-full overflow-hidden rounded-3xl bg-accent-subtle sm:h-80 lg:h-96">
                {/* Guard against a post with no cover image (e.g. a
                    pre-migration row) — next/image throws on an empty src,
                    so this must stay conditional. Same height either way so
                    the title card below still lands at the same offset. */}
                {post.coverImage && (
                  <Image
                    src={post.coverImage}
                    alt=""
                    fill
                    priority
                    sizes="(max-width: 1280px) 100vw, 1280px"
                    className="object-cover"
                  />
                )}
                <div
                  className="absolute inset-0 bg-linear-to-t from-surface-inverse/85 via-surface-inverse/25 to-surface-inverse/10"
                  aria-hidden="true"
                />
              </div>
            </Container>

            <Container className="relative -mt-20 max-w-[1100px] pb-2 sm:-mt-24">
              <div className="rounded-card border border-default bg-surface-raised p-6 shadow-xl sm:p-8">
                <Link
                  href="/blog"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent transition-colors hover:text-accent-hover"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  Back to blog
                </Link>

                <span className="mt-4 inline-flex w-fit items-center rounded-full bg-accent-subtle px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-accent">
                  {post.category}
                </span>
                <h1 className="mt-3 text-2xl font-bold tracking-tight text-primary sm:text-3xl lg:text-4xl">
                  {post.title}
                </h1>

                <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <User className="h-4 w-4" aria-hidden="true" />
                    {post.author}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" aria-hidden="true" />
                    <time dateTime={post.publishedAt}>{formatPostDate(post.publishedAt)}</time>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-4 w-4" aria-hidden="true" />
                    {post.readMinutes} min read
                  </span>
                </div>
              </div>
            </Container>
          </section>

          {/* Body — same max-w-3xl as the hero card and the related-posts
              section below, so the whole article page reads as one column
              instead of the text suddenly narrowing. article-content's larger
              type + looser line-height (globals.css) carries the readability
              instead of an extra-narrow measure. */}
          <section className="py-12 sm:py-16">
            <Container className="max-w-[1100px]">
              <div
                className="article-content"
                dangerouslySetInnerHTML={{ __html: safeContent }}
              />

              {post.tags.length > 0 && (
                <div className="mt-10 flex flex-wrap gap-2 border-t border-default/70 pt-6">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-default bg-surface px-3 py-1 text-xs font-semibold text-secondary"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Byline footer — a clear "who wrote this" anchor at the end,
                  separate from the meta row up in the hero so the body reads
                  clean without repeating icons every paragraph. */}
              <div className="mt-8 flex items-center gap-3 rounded-card border border-default bg-surface-raised p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-sm font-bold text-accent">
                  {post.author?.[0]?.toUpperCase() ?? "R"}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-primary">{post.author}</p>
                  <p className="text-xs text-muted">
                    Published {formatPostDate(post.publishedAt)}
                    {post.updatedAt && post.updatedAt !== post.publishedAt
                      ? ` · Updated ${formatPostDate(post.updatedAt)}`
                      : ""}
                  </p>
                </div>
              </div>

              <Link
                href="/blog"
                className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-accent transition-colors hover:text-accent-hover"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Back to all posts
              </Link>
            </Container>
          </section>

          {related.length > 0 && (
            <section className="border-t border-default/60 bg-surface-sunken py-14 sm:py-16">
              <Container className="max-w-[1100px]">
                <h2 className="text-lg font-bold tracking-tight text-primary">More on the blog</h2>
                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  {related.map((r) => (
                    <Link
                      key={r.slug}
                      href={`/blog/${r.slug}`}
                      className="group flex flex-col overflow-hidden rounded-card border border-default bg-surface-raised shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-accent/30 hover:shadow-lg"
                    >
                      {r.coverImage && (
                        <div className="relative h-28 w-full overflow-hidden">
                          <Image
                            src={r.coverImage}
                            alt=""
                            fill
                            sizes="(max-width: 640px) 100vw, 33vw"
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        </div>
                      )}
                      <div className="flex flex-1 flex-col p-4">
                        <span className="text-sm font-bold leading-snug text-primary transition-colors duration-200 group-hover:text-accent">
                          {r.title}
                        </span>
                        <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent">
                          Read
                          <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </Container>
            </section>
          )}
        </article>
      </main>

      <SiteFooter />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
