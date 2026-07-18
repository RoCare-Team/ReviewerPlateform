/**
 * The one place the page's max width lives. Brief: 1280px = Tailwind max-w-7xl.
 * Change it here and every section moves together — never hardcode a max-w-* on
 * an individual section.
 */
export default function Container({ as: Tag = "div", className = "", children }) {
  return (
    <Tag className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</Tag>
  );
}
