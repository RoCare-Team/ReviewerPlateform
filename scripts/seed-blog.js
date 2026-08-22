/**
 * One-time load of the starter blog posts (data/blog.js) into MongoDB. Run
 * once on a fresh database, or again after a content-model change:
 *
 *   node --env-file=.env.local scripts/seed-blog.js
 *
 * Re-run-safe: each post is upserted by slug (deleted + recreated), so this
 * never duplicates. After this, author new posts from /admin/blog — this
 * script and data/blog.js are seed sources only, not read by the running app.
 *
 * data/blog.js stores legacy block content ({heading, body[], list[]}) from
 * before the rich-text editor; this script converts it to the HTML string
 * BlogPost.content now expects. New posts written from /admin/blog produce
 * HTML directly and never go through this conversion.
 */
import mongoose from "mongoose";

const { MONGODB_URI } = process.env;
if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set. Is .env.local present?");
  process.exit(1);
}

const { default: BlogPost } = await import("../src/models/BlogPost.js");
const { POSTS } = await import("../data/blog.js");

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function blocksToHtml(blocks) {
  return (blocks ?? [])
    .map((b) => {
      const parts = [];
      if (b.heading) parts.push(`<h2>${escapeHtml(b.heading)}</h2>`);
      for (const p of b.body ?? []) parts.push(`<p>${escapeHtml(p)}</p>`);
      if (b.list?.length) {
        parts.push(`<ul>${b.list.map((li) => `<li>${escapeHtml(li)}</li>`).join("")}</ul>`);
      }
      return parts.join("\n");
    })
    .join("\n");
}

// No brand cover photography shipped yet — every seeded post uses the same
// neutral placeholder so the schema's required coverImage is satisfied.
// Replace per-post from /admin/blog whenever real cover art is ready.
const PLACEHOLDER_COVER = "/img/hero5.png";

await mongoose.connect(MONGODB_URI);

let created = 0;

for (const post of POSTS) {
  await BlogPost.deleteOne({ slug: post.slug });
  await BlogPost.create({
    title: post.title,
    slug: post.slug,
    description: post.description,
    excerpt: post.excerpt,
    category: post.category,
    tags: post.tags,
    author: post.author,
    content: blocksToHtml(post.content),
    coverImage: PLACEHOLDER_COVER,
    status: "published",
    publishedAt: new Date(post.publishedAt),
  });
  created++;
}

console.log(`\nSeeded blog posts: ${created} written.\n`);

await mongoose.disconnect();
