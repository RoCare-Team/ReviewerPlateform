/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
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
};

export default nextConfig;
