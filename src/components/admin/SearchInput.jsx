"use client";

import { Search, X } from "lucide-react";

/**
 * Search box for the admin tables. Controlled by the parent so the parent owns
 * the filtering — this is presentation only.
 *
 * Filtering happens in the browser over rows already fetched (both admin pages
 * cap at 500 rows), so results are instant and there is no round trip per
 * keystroke. If those lists ever outgrow the cap, this needs to move to a
 * server query — a search box that silently only searches the first 500 rows
 * would be worse than no search box.
 */
export default function SearchInput({ value, onChange, placeholder, resultLabel }) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <div className="group relative min-w-0 flex-1 sm:max-w-sm">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted transition-colors duration-200 group-focus-within:text-accent"
          aria-hidden="true"
        />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full rounded-btn border border-default bg-surface py-2.5 pl-10 pr-9 text-sm text-primary outline-none transition-all duration-200 placeholder:text-muted/70 hover:border-strong focus:border-accent focus:ring-2 focus:ring-accent/50"
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {/* aria-live so a screen reader hears the count change as you type. */}
      <p className="nums text-sm text-muted" aria-live="polite">
        {resultLabel}
      </p>
    </div>
  );
}
