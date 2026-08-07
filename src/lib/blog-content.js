import sanitizeHtml from "sanitize-html";

/**
 * The Tiptap editor in /admin/blog produces this HTML on the client; every
 * write path (create + update) runs it through here first. Admin-only input
 * is a lower risk profile than public input, but not zero — a compromised
 * admin session or an editor bug are still worth guarding against before this
 * HTML gets stored and later rendered with dangerouslySetInnerHTML.
 *
 * sanitize-html, not isomorphic-dompurify/DOMPurify — DOMPurify's "isomorphic"
 * build pulls in jsdom to fake a DOM on the server, and jsdom is a known
 * source of cold-start/bundling failures in serverless runtimes (Vercel
 * functions included). sanitize-html parses HTML with a plain JS parser, no
 * DOM shim, so there's nothing there to fail to load.
 */
const ALLOWED_TAGS = [
  "p", "br", "strong", "em", "u", "s", "a",
  "h2", "h3", "h4",
  "ul", "ol", "li",
  "blockquote", "pre", "code",
  "img", "hr",
];
const ALLOWED_ATTR = { a: ["href", "target", "rel", "title"], img: ["src", "alt", "title", "class"], "*": ["class"] };

/**
 * BlogPost.content used to be a block array ({heading, body[], list[]})
 * before the rich-text editor landed — a handful of posts can still be in
 * that shape if the DB wasn't re-seeded. Coerce anything that isn't already
 * a string to one instead of throwing: a stale post should render as best it
 * can (or come up empty), never take the whole page down with it.
 */
function toHtmlString(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((block) => {
        if (!block || typeof block !== "object") return "";
        const parts = [];
        if (block.heading) parts.push(`<h2>${block.heading}</h2>`);
        for (const p of block.body ?? []) parts.push(`<p>${p}</p>`);
        if (block.list?.length) parts.push(`<ul>${block.list.map((li) => `<li>${li}</li>`).join("")}</ul>`);
        return parts.join("");
      })
      .join("");
  }
  return "";
}

export function sanitizeContentHtml(html) {
  return sanitizeHtml(toHtmlString(html), {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTR,
    // http(s) only — blocks javascript:/data: URIs in href/src.
    allowedSchemes: ["http", "https"],
  });
}

/** True if the sanitized HTML has no visible text and no image. */
export function isContentEmpty(html) {
  const str = toHtmlString(html);
  const stripped = str.replace(/<[^>]*>/g, "").trim();
  return stripped.length === 0 && !/<img\b/i.test(str);
}

/** ~200 wpm off the visible text (tags stripped). Minimum 1 minute. */
export function estimateReadMinutes(html) {
  const text = toHtmlString(html).replace(/<[^>]*>/g, " ");
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
