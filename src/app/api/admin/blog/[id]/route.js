import { z } from "zod";
import { revalidatePath } from "next/cache";
import { apiRequireAdmin } from "../../../../../lib/auth/guards";
import dbConnect from "../../../../../lib/db";
import BlogPost from "../../../../../models/BlogPost";
import { getPostByIdAdmin, uniqueSlug } from "../../../../../lib/blog";
import { sanitizeContentHtml, isContentEmpty } from "../../../../../lib/blog-content";

const schema = z
  .object({
    title: z.string().trim().min(1).max(200),
    slug: z.string().trim().min(1).max(100),
    description: z.string().trim().min(1).max(300),
    excerpt: z.string().trim().min(1).max(300),
    category: z.string().trim().min(1).max(60),
    tags: z.array(z.string().trim().min(1)).max(20).default([]),
    author: z.string().trim().max(80).optional(),
    content: z.string().max(50000).default(""),
    coverImage: z.string().trim().min(1, "Add a cover image.").max(500),
    status: z.enum(["draft", "published"]),
  })
  .strict();

export async function GET(request, { params }) {
  const { response } = await apiRequireAdmin();
  if (response) return response;

  const { id } = await params;
  const post = await getPostByIdAdmin(id);
  if (!post) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ post });
}

export async function PATCH(request, { params }) {
  const { response } = await apiRequireAdmin();
  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { title, slug, description, excerpt, category, tags, author, content, coverImage, status } = parsed.data;

  const clean = sanitizeContentHtml(content);
  if (isContentEmpty(clean)) {
    return Response.json({ error: "Add some content for the post." }, { status: 400 });
  }

  await dbConnect();
  const existing = await BlogPost.findById(id);
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  const finalSlug = slug === existing.slug ? existing.slug : await uniqueSlug(slug, id);
  const wasPublished = existing.status === "published";
  const oldSlug = existing.slug;

  existing.title = title;
  existing.slug = finalSlug;
  existing.description = description;
  existing.excerpt = excerpt;
  existing.category = category;
  existing.tags = tags;
  if (author) existing.author = author;
  existing.content = clean;
  existing.coverImage = coverImage;
  existing.status = status;
  // Set publishedAt the first time it goes live; never overwritten by a later edit.
  if (status === "published" && !existing.publishedAt) existing.publishedAt = new Date();
  await existing.save();

  // Revalidate whatever was live before AND whatever is live now — covers
  // publish, unpublish, slug change, and a plain content edit alike.
  revalidatePath("/blog");
  if (wasPublished) revalidatePath(`/blog/${oldSlug}`);
  if (status === "published") revalidatePath(`/blog/${finalSlug}`);

  return Response.json({ ok: true, slug: finalSlug });
}

export async function DELETE(request, { params }) {
  const { response } = await apiRequireAdmin();
  if (response) return response;

  const { id } = await params;
  await dbConnect();
  const existing = await BlogPost.findByIdAndDelete(id);
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  revalidatePath("/blog");
  if (existing.status === "published") revalidatePath(`/blog/${existing.slug}`);

  return Response.json({ ok: true });
}
