import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "../../../../../lib/auth/guards";
import { getPostByIdAdmin } from "../../../../../lib/blog";
import BlogPostForm from "../../../../../components/admin/BlogPostForm";

export const metadata = { title: "Edit post · Admin", robots: { index: false } };

export default async function EditBlogPostPage({ params }) {
  await requireAdmin();
  const { id } = await params;

  const post = await getPostByIdAdmin(id);
  if (!post) notFound();

  return (
    <div>
      <Link
        href="/admin/blog"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to blog
      </Link>

      <h1 className="mt-4 text-2xl font-bold tracking-tight text-primary">Edit post</h1>

      <div className="mt-6">
        <BlogPostForm mode="edit" postId={post.id} initial={post} />
      </div>
    </div>
  );
}
