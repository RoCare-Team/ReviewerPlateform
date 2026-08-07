"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, ImagePlus, Loader2, Save, X } from "lucide-react";
import { Label, Input, FieldError, FormError } from "../auth/Field";
import RichTextEditor from "./RichTextEditor";
import { toast } from "../../lib/toast";

/**
 * Shared create/edit form for /admin/blog/new and /admin/blog/[id]. Content
 * is authored in RichTextEditor (Tiptap) and stored as sanitized HTML — see
 * src/lib/blog-content.js. A cover image is required on every post; it's
 * uploaded to Cloudinary the moment it's picked, same endpoint the editor's
 * inline image button uses.
 */
export default function BlogPostForm({ mode, postId, initial }) {
  const router = useRouter();
  const coverInputRef = useRef(null);
  const [values, setValues] = useState({
    title: initial?.title ?? "",
    slug: initial?.slug ?? "",
    description: initial?.description ?? "",
    excerpt: initial?.excerpt ?? "",
    category: initial?.category ?? "",
    tags: (initial?.tags ?? []).join(", "),
    author: initial?.author ?? "",
    content: initial?.content ?? "",
    coverImage: initial?.coverImage ?? "",
    status: initial?.status ?? "draft",
  });
  const [pending, setPending] = useState(null); // null | "draft" | "published"
  const [coverUploading, setCoverUploading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  function set(key) {
    return (e) => setValues((v) => ({ ...v, [key]: e.target.value }));
  }

  async function onPickCover(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setCoverUploading(true);
    const form = new FormData();
    form.append("image", file);
    const res = await fetch("/api/admin/blog/upload-image", { method: "POST", body: form });
    setCoverUploading(false);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      toast.error(data.error ?? "Cover image upload failed.");
      return;
    }
    setValues((v) => ({ ...v, coverImage: data.url }));
    setFieldErrors((fe) => ({ ...fe, coverImage: undefined }));
  }

  async function submit(status) {
    setError("");
    setFieldErrors({});

    if (!values.coverImage) {
      setFieldErrors({ coverImage: ["Add a cover image."] });
      toast.error("Add a cover image before saving.");
      return;
    }

    setPending(status);

    const payload = {
      title: values.title.trim(),
      description: values.description.trim(),
      excerpt: values.excerpt.trim(),
      category: values.category.trim(),
      tags: values.tags.split(",").map((t) => t.trim()).filter(Boolean),
      author: values.author.trim() || undefined,
      content: values.content,
      coverImage: values.coverImage,
      status,
    };
    if (mode === "edit") payload.slug = values.slug.trim();
    else if (values.slug.trim()) payload.slug = values.slug.trim();

    const endpoint = mode === "edit" ? `/api/admin/blog/${postId}` : "/api/admin/blog";
    const res = await fetch(endpoint, {
      method: mode === "edit" ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setPending(null);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (data.details) setFieldErrors(data.details);
      const message = data.error ?? "Something went wrong. Please try again.";
      setError(message);
      toast.error(message);
      return;
    }

    toast.success(status === "published" ? "Post published." : "Draft saved.");
    router.push("/admin/blog");
    router.refresh();
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} className="max-w-3xl space-y-6">
      <FormError>{error}</FormError>

      {/* Cover image */}
      <div className="rounded-card border border-default bg-surface-raised p-6 shadow-sm">
        <Label htmlFor="cover">Cover image</Label>
        {values.coverImage ? (
          <div className="relative mt-2 overflow-hidden rounded-2xl border border-default">
            <Image
              src={values.coverImage}
              alt=""
              width={1200}
              height={630}
              className="h-48 w-full object-cover object-top"
              unoptimized
            />
            <button
              type="button"
              onClick={() => setValues((v) => ({ ...v, coverImage: "" }))}
              aria-label="Remove cover image"
              className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface-inverse/70 text-white transition-colors hover:bg-danger"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            disabled={coverUploading}
            className={`mt-2 flex h-40 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed bg-surface text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
              fieldErrors.coverImage ? "border-danger text-danger" : "border-default text-secondary hover:border-accent/40 hover:bg-surface-sunken"
            }`}
          >
            {coverUploading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                Uploading…
              </>
            ) : (
              <>
                <ImagePlus className="h-5 w-5" aria-hidden="true" />
                Click to upload a cover image
              </>
            )}
          </button>
        )}
        <input
          ref={coverInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={onPickCover}
        />
        <FieldError id="cover-error">{fieldErrors.coverImage?.[0]}</FieldError>
        <p className="mt-1.5 text-xs text-muted">
          Shown on the blog listing card and at the top of the post. Required — PNG, JPG or WebP, up to 5 MB.
        </p>
      </div>

      <div className="rounded-card border border-default bg-surface-raised p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={values.title}
              onChange={set("title")}
              placeholder="Why Verified Reviews Beat Bought Reviews"
              error={fieldErrors.title?.[0]}
            />
            <FieldError id="title-error">{fieldErrors.title?.[0]}</FieldError>
          </div>

          {mode === "edit" && (
            <div className="sm:col-span-2">
              <Label htmlFor="slug">URL slug</Label>
              <Input
                id="slug"
                value={values.slug}
                onChange={set("slug")}
                placeholder="why-verified-reviews-beat-bought-reviews"
                className="font-mono text-sm"
                error={fieldErrors.slug?.[0]}
              />
              <p className="mt-1.5 text-xs text-muted">
                /blog/{values.slug || "…"} — changing this breaks any links already out there.
              </p>
              <FieldError id="slug-error">{fieldErrors.slug?.[0]}</FieldError>
            </div>
          )}

          <div>
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              value={values.category}
              onChange={set("category")}
              placeholder="Reputation management"
              error={fieldErrors.category?.[0]}
            />
            <FieldError id="category-error">{fieldErrors.category?.[0]}</FieldError>
          </div>

          <div>
            <Label htmlFor="author">Author</Label>
            <Input id="author" value={values.author} onChange={set("author")} placeholder="RapportLook Team" />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              value={values.tags}
              onChange={set("tags")}
              placeholder="verified reviews, review policy, trust"
            />
            <p className="mt-1.5 text-xs text-muted">Comma-separated.</p>
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="description">Meta description</Label>
            <textarea
              id="description"
              rows={2}
              value={values.description}
              onChange={set("description")}
              maxLength={300}
              placeholder="One or two sentences — this is what shows up in search results."
              className="w-full resize-none rounded-2xl border border-default bg-surface px-3 py-2.5 text-primary outline-none transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/50"
            />
            <FieldError id="description-error">{fieldErrors.description?.[0]}</FieldError>
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="excerpt">Card excerpt</Label>
            <textarea
              id="excerpt"
              rows={2}
              value={values.excerpt}
              onChange={set("excerpt")}
              maxLength={300}
              placeholder="Shown on the blog listing card, under the title."
              className="w-full resize-none rounded-2xl border border-default bg-surface px-3 py-2.5 text-primary outline-none transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/50"
            />
            <FieldError id="excerpt-error">{fieldErrors.excerpt?.[0]}</FieldError>
          </div>
        </div>
      </div>

      <div className="rounded-card border border-default bg-surface-raised p-6 shadow-sm">
        <Label htmlFor="content">Content</Label>
        <div className="mt-2">
          <RichTextEditor
            value={values.content}
            onChange={(html) => setValues((v) => ({ ...v, content: html }))}
            placeholder="Write the post…"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => submit("draft")}
          disabled={pending !== null}
          className="inline-flex items-center gap-2 rounded-btn border border-strong bg-surface px-5 py-2.5 text-sm font-semibold text-primary transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface-sunken hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending === "draft" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
          Save as draft
        </button>
        <button
          type="button"
          onClick={() => submit("published")}
          disabled={pending !== null}
          className="inline-flex items-center gap-2 rounded-btn bg-accent px-5 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending === "published" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          {initial?.status === "published" ? "Save & keep published" : "Publish"}
        </button>
      </div>
    </form>
  );
}
