import { z } from "zod";
import { revalidatePath } from "next/cache";
import { apiRequireAdmin } from "../../../../../../lib/auth/guards";
import dbConnect from "../../../../../../lib/db";
import BlogPost from "../../../../../../models/BlogPost";

const schema = z.object({ status: z.enum(["draft", "published"]) }).strict();

/**
 * Status-only flip — the draft/published toggle on /admin/blog's list. A
 * separate route from PATCH /api/admin/blog/[id] on purpose: that one always
 * requires the full post payload (title, content, cover image, …) for the
 * edit form's save, and re-sending all of that just to flip one field would
 * mean the list either duplicates the edit form's state or round-trips a GET
 * first. This just flips the one field it's for.
 */
export async function PATCH(request, { params }) {
  const { response } = await apiRequireAdmin();
  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid status." }, { status: 400 });
  const { status } = parsed.data;

  await dbConnect();
  const existing = await BlogPost.findById(id);
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  const wasPublished = existing.status === "published";
  existing.status = status;
  // Set publishedAt the first time it goes live; never overwritten by a
  // later unpublish/republish cycle — see the PATCH route's identical rule.
  if (status === "published" && !existing.publishedAt) existing.publishedAt = new Date();
  await existing.save();

  revalidatePath("/blog");
  if (wasPublished || status === "published") revalidatePath(`/blog/${existing.slug}`);

  return Response.json({ ok: true, status: existing.status });
}
