import { getCitySlugs } from "../lib/cities";
import { getPublishedSlugs } from "../lib/blog";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.rapportlook.com";

// Next.js App Router convention — this file IS /sitemap.xml, generated at
// request time so new blog posts (published from /admin/blog) and cities
// appear without a manual step. Only public, indexable routes belong here: no
// /login, /signup/*, /admin, /business, /reviewer — those are noindexed in
// their own layouts and have no business being crawled.
export default async function sitemap() {
  const now = new Date().toISOString();

  const staticRoutes = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/signup", priority: 0.7, changeFrequency: "monthly" },
    { path: "/signup/business", priority: 0.7, changeFrequency: "monthly" },
    { path: "/signup/reviewer", priority: 0.6, changeFrequency: "monthly" },
    { path: "/about", priority: 0.6, changeFrequency: "monthly" },
    { path: "/contact", priority: 0.5, changeFrequency: "monthly" },
    { path: "/careers", priority: 0.4, changeFrequency: "monthly" },
    { path: "/blog", priority: 0.7, changeFrequency: "weekly" },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
    { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
    { path: "/refund", priority: 0.3, changeFrequency: "yearly" },
  ].map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  const cityRoutes = getCitySlugs().map((slug) => ({
    url: `${SITE_URL}/services/${slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const blogSlugs = await getPublishedSlugs();
  const blogRoutes = blogSlugs.map((slug) => ({
    url: `${SITE_URL}/blog/${slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [...staticRoutes, ...cityRoutes, ...blogRoutes];
}
