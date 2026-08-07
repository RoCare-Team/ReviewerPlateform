import Link from "next/link";
import { Newspaper, Plus } from "lucide-react";
import { requireAdmin } from "../../../../lib/auth/guards";
import { getAllPostsAdmin } from "../../../../lib/blog";
import BlogPostList from "../../../../components/admin/BlogPostList";

export const metadata = { title: "Blog · Admin", robots: { index: false } };

export default async function AdminBlogPage() {
  await requireAdmin();
  const posts = await getAllPostsAdmin();
  const publishedCount = posts.filter((p) => p.status === "published").length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-subtle text-accent">
            <Newspaper className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-primary">Blog</h1>
            <p className="text-sm text-secondary">
              {posts.length} total · {publishedCount} published
            </p>
          </div>
        </div>
        <Link
          href="/admin/blog/new"
          className="inline-flex items-center gap-2 rounded-btn bg-accent px-4 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-md"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New post
        </Link>
      </div>

      <BlogPostList posts={posts} />
    </div>
  );
}
