import { z } from "zod";
import { revalidatePath } from "next/cache";
import { apiRequireAdmin } from "../../../../lib/auth/guards";
import dbConnect from "../../../../lib/db";
import BlogPost from "../../../../models/BlogPost";
import { getAllPostsAdmin, uniqueSlug } from "../../../../lib/blog";
import { sanitizeContentHtml, isContentEmpty } from "../../../../lib/blog-content";

const schema = z
  .object({
    title: z.string().trim().min(1).max(200),
    slug: z.string().trim().max(100).optional(),
    description: z.string().trim().min(1).max(300),
    excerpt: z.string().trim().min(1).max(300),
    category: z.string().trim().min(1).max(60),
    tags: z.array(z.string().trim().min(1)).max(20).default([]),
    author: z.string().trim().max(80).optional(),
    content: z.string().max(50000).default(""),
    coverImage: z.string().trim().min(1, "Add a cover image.").max(500),
    status: z.enum(["draft", "published"]).default("draft"),
  })
  .strict();

export async function GET() {
  const { response } = await apiRequireAdmin();
  if (response) return response;

  const posts = await getAllPostsAdmin();
  return Response.json({ posts });
}

export async function POST(request) {
  const { user, response } = await apiRequireAdmin();
  if (response) return response;

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
  const finalSlug = await uniqueSlug(slug || title);

  const post = await BlogPost.create({
    title,
    slug: finalSlug,
    description,
    excerpt,
    category,
    tags,
    author: author || undefined,
    content: clean,
    coverImage,
    status,
    publishedAt: status === "published" ? new Date() : null,
    createdBy: user.id,
  });

  if (status === "published") {
    revalidatePath("/blog");
    revalidatePath(`/blog/${finalSlug}`);
  }

  return Response.json({ ok: true, id: String(post._id), slug: finalSlug }, { status: 201 });
}
