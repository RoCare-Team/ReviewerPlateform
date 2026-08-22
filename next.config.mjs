/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Serve AVIF when the browser supports it (smaller than WebP), falling
    // back to WebP — addresses Lighthouse's "Improve image delivery" audit.
    formats: ["image/avif", "image/webp"],
    // Blog cover images and inline post images are uploaded to Cloudinary
    // (see src/lib/cloudinary.js) — next/image refuses to optimize a remote
    // src unless its host is explicitly allow-listed here.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        // Placeholder headshots for the static homepage testimonials only
        // (src/components/site/Testimonials.jsx). Swap for real, consented
        // photos before launch — see the note in that file.
        protocol: "https",
        hostname: "randomuser.me",
      },
    ],
  },

  // There's no standalone signup page anymore — /login (PhoneOtpForm.jsx)
  // handles both: an already-registered phone signs straight in, a new one
  // gets asked for a role + name right there. These just catch anyone who
  // still has the old /signup* URLs bookmarked, linked, or indexed.
  async redirects() {
    return [
      { source: "/signup", destination: "/login", permanent: true },
      { source: "/signup/business", destination: "/login", permanent: true },
      { source: "/signup/reviewer", destination: "/login", permanent: true },
    ];
  },
};

export default nextConfig;
