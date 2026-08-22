const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.rapportlook.com";

// App Router convention — this file IS /robots.txt. Signed-in dashboards,
// auth flows, and admin are already noindexed via their own layout metadata
// (belt-and-suspenders, not redundant: robots.txt stops crawling, the
// noindex meta tag stops indexing a page that got crawled some other way).
export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin",
          "/business",
          "/reviewer",
          "/login",
          "/forgot-password",
          "/reset-password",
          "/verify-otp",
          "/auth-error",
          "/post-login",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
