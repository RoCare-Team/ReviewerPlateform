import DOMPurify from "isomorphic-dompurify";

/**
 * The Tiptap editor in /admin/blog produces this HTML on the client; every
 * write path (create + update) runs it through here first. Admin-only input
 * is a lower risk profile than public input, but not zero — a compromised
 * admin session or an editor bug are still worth guarding against before this
 * HTML gets stored and later rendered with dangerouslySetInnerHTML.
 */
const ALLOWED_TAGS = [
  "p", "br", "strong", "em", "u", "s", "a",
  "h2", "h3", "h4",
  "ul", "ol", "li",
  "blockquote", "pre", "code",
  "img", "hr",
];
const ALLOWED_ATTR = ["href", "target", "rel", "src", "alt", "title", "class"];

export function sanitizeContentHtml(html) {
  return DOMPurify.sanitize(html ?? "", {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}

/** True if the sanitized HTML has no visible text and no image. */
export function isContentEmpty(html) {
  const stripped = (html ?? "").replace(/<[^>]*>/g, "").trim();
  return stripped.length === 0 && !/<img\b/i.test(html ?? "");
}

/** ~200 wpm off the visible text (tags stripped). Minimum 1 minute. */
export function estimateReadMinutes(html) {
  const text = (html ?? "").replace(/<[^>]*>/g, " ");
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
