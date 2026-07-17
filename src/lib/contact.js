import contact from "../../data/contact.json";

/**
 * The ONLY reader of data/contact.json. Import from here, never the JSON directly —
 * that's what keeps the single-source-of-truth promise the file makes.
 */

/** Values in contact.json are still "TODO" placeholders. Treat those as absent
 *  rather than rendering the literal string "TODO" into a page or an email. */
export function isPlaceholder(value) {
  return typeof value !== "string" || value.trim() === "" || value.trim() === "TODO";
}

/** Dot-path getter. Returns `fallback` for missing OR placeholder values. */
export function getContact(path, fallback = null) {
  const value = path.split(".").reduce((acc, key) => acc?.[key], contact);
  if (value === undefined || value === null) return fallback;
  if (isPlaceholder(value)) return fallback;
  return value;
}

/** Resolve a plan's supportSlaRef ("support.sla.growth") into its value. */
export function resolveRef(ref, fallback = null) {
  if (!ref || typeof ref !== "string") return fallback;
  return getContact(ref, fallback);
}

/** Which contact fields are still unfilled — use in a pre-launch check. */
export function missingContactFields(paths) {
  return paths.filter((p) => getContact(p) === null);
}

export { contact as raw };
