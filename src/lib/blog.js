import dbConnect from "./db";
import BlogPost from "../models/BlogPost";
import { estimateReadMinutes } from "./blog-content";

/** a-z0-9 words joined by single hyphens, ASCII-safe for a URL segment. */
export function slugify(input) {
  return (input ?? "")
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

/** Appends -2, -3, ... until the slug is free. excludeId lets an edit keep its own slug. */
export async function uniqueSlug(base, excludeId = null) {
  await dbConnect();
  const root = slugify(base) || "post";
  let candidate = root;
  let n = 2;
  // A handful of posts at most ever collide on the same title — this never
  // loops more than a few times in practice.
  while (
    await BlogPost.exists({ slug: candidate, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })
  ) {
    candidate = `${root}-${n++}`;
  }
  return candidate;
}

function serialize(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id),
    title: doc.title,
    slug: doc.slug,
    description: doc.description,
    excerpt: doc.excerpt,
    category: doc.category,
    tags: doc.tags ?? [],
    author: doc.author,
    content: doc.content ?? "",
    coverImage: doc.coverImage ?? "",
    status: doc.status,
    publishedAt: doc.publishedAt ? doc.publishedAt.toISOString() : null,
    updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : null,
    createdAt: doc.createdAt ? doc.createdAt.toISOString() : null,
    readMinutes: estimateReadMinutes(doc.content),
  };
}

/** Public listing — published only, newest first. */
export async function getPublishedPosts() {
  await dbConnect();
  const docs = await BlogPost.find({ status: "published" }).sort({ publishedAt: -1 }).lean();
  return docs.map(serialize);
}

/** Public detail — published only, so a draft URL 404s for a visitor. */
export async function getPublishedPostBySlug(slug) {
  await dbConnect();
  const doc = await BlogPost.findOne({ slug, status: "published" }).lean();
  return serialize(doc);
}

/** Public slug list — sitemap only needs published URLs. */
export async function getPublishedSlugs() {
  await dbConnect();
  const docs = await BlogPost.find({ status: "published" }).select("slug").lean();
  return docs.map((d) => d.slug);
}

/** Same-category posts first, newest first, excluding the current post. */
export async function getRelatedPosts(slug, category, limit = 3) {
  await dbConnect();
  // Blog is small by design (this is an admin-authored content set, not a
  // firehose) — fetching everything else and sorting in JS is simpler and
  // correct, vs. a $sort that can't actually express "this category first".
  const docs = await BlogPost.find({ status: "published", slug: { $ne: slug } })
    .sort({ publishedAt: -1 })
    .lean();

  return docs
    .map(serialize)
    .sort((a, b) => (a.category === category ? -1 : 0) - (b.category === category ? -1 : 0))
    .slice(0, limit);
}

/** Admin listing — every status, newest first. */
export async function getAllPostsAdmin() {
  await dbConnect();
  const docs = await BlogPost.find({}).sort({ createdAt: -1 }).lean();
  return docs.map(serialize);
}

export async function getPostByIdAdmin(id) {
  await dbConnect();
  const doc = await BlogPost.findById(id).lean().catch(() => null);
  return serialize(doc);
}

export function formatPostDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}
