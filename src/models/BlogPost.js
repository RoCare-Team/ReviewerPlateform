import mongoose from "mongoose";

/**
 * content is sanitized HTML from the Tiptap rich-text editor in
 * /admin/blog — see src/lib/blog-content.js for the sanitize step (server
 * side, on every write) and src/app/blog/[slug]/page.jsx for the render step
 * (sanitized again there too — defense in depth against a compromised admin
 * session or a bug upstream, not just trust-on-write).
 */
const BlogPostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },

    // URL segment — /blog/[slug]. Unique and immutable-in-spirit (changing it
    // breaks inbound links), but not literally locked: an admin editing a
    // published post's slug is a deliberate action, not an accident.
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },

    description: { type: String, required: true, trim: true }, // meta description
    excerpt: { type: String, required: true, trim: true }, // card/listing summary

    category: { type: String, required: true, trim: true },
    tags: { type: [String], default: [] },
    author: { type: String, trim: true, default: "RapportLook Team" },

    content: { type: String, required: true }, // sanitized HTML

    // Required — every post needs a cover image for the listing card and the
    // detail-page hero. Enforced in the admin API schema (Mongoose enforces
    // it here too as a backstop).
    coverImage: { type: String, trim: true, required: true },

    status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
    // Set the first time a post transitions to "published" and left alone
    // after that — this is the date search engines and the listing sort by,
    // not "last edited".
    publishedAt: { type: Date, default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export default mongoose.models.BlogPost || mongoose.model("BlogPost", BlogPostSchema);
