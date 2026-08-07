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
    ],
  },
};

export default nextConfig;
