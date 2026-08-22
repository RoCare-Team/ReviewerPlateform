/**
 * The one place the page's max width lives. Brief: 1280px = Tailwind max-w-7xl.
 * Change it here and every section moves together — never hardcode a max-w-* on
 * an individual section.
 *
 * A caller may override with its own max-w-* in `className` (e.g. "max-w-3xl"
 * for a narrower text column). When it does, this component's own max-w-7xl is
 * dropped entirely rather than both being emitted — Tailwind v4 orders utility
 * CSS by its own internal registry, not by source position, so two max-w-*
 * classes on one element don't reliably resolve to "the last one in the
 * className string" the way you'd expect. Stacking them silently picked
 * whichever the compiler happened to emit last (max-w-7xl beat max-w-2xl and
 * max-w-3xl every time), so several pages were never actually narrowed on a
 * wide monitor. One max-w-* per element, always.
 */
export default function Container({ as: Tag = "div", className = "", children }) {
  const hasOwnMaxWidth = /(^|\s)max-w-/.test(className);

  return (
    <Tag
      className={`mx-auto w-full px-4 sm:px-6 lg:px-8 ${hasOwnMaxWidth ? "" : "max-w-7xl"} ${className}`}
    >
      {children}
    </Tag>
  );
}
