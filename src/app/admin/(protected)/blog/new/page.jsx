import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "../../../../../lib/auth/guards";
import BlogPostForm from "../../../../../components/admin/BlogPostForm";

export const metadata = { title: "New post · Admin", robots: { index: false } };

export default async function NewBlogPostPage() {
  await requireAdmin();

  return (
    <div>
      <Link
        href="/admin/blog"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to blog
      </Link>

      <h1 className="mt-4 text-2xl font-bold tracking-tight text-primary">New post</h1>
      <p className="mt-1 text-sm text-secondary">
        Save as a draft to keep working on it, or publish to make it live immediately.
      </p>

      <div className="mt-6">
        <BlogPostForm mode="create" />
      </div>
    </div>
  );
}
