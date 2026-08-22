"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Plus, X, Search, Loader2 } from "lucide-react";

/**
 * Multi-city picker backed by Google Places (api/business/places/cities,
 * see lib/googlePlaces.js) — lets ONE campaign be open to reviewers across
 * several cities instead of the old single state+city dropdown.
 *
 * Type to search → click a suggestion (or its + button) to add it as a chip
 * → remove any chip with its × any time. Typing something with no matching
 * suggestion and pressing Enter adds it as-typed too, so a city Google's
 * autocomplete doesn't recognize (or the search API being unconfigured/down)
 * never blocks the form — it degrades to "just type it".
 *
 * `cities` is the plain array of city-name strings on the parent's form
 * state; `onChange` receives the whole next array (same shape as every other
 * controlled field in NewCampaignModal/EditCampaignModal).
 */
export default function CityMultiSelect({ cities, onChange, idPrefix = "city-multi" }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Nothing to clear here — the render below only shows suggestions when
    // the query is long enough, so stale results from a shortened query
    // just never get rendered rather than needing an imperative reset.
    if (query.trim().length < 2) return;
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/business/places/cities?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json().catch(() => ({}));
        setSuggestions(Array.isArray(data.cities) ? data.cities : []);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Click outside closes the suggestion dropdown.
  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function addCity(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const already = cities.some((c) => c.toLowerCase() === trimmed.toLowerCase());
    if (!already) onChange([...cities, trimmed]);
    setQuery("");
    setSuggestions([]);
    setOpen(false);
  }

  function removeCity(name) {
    onChange(cities.filter((c) => c !== name));
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      addCity(suggestions[0]?.city ?? query);
    }
  }

  return (
    <div>
      <div ref={boxRef} className="relative">
        <div className="group relative flex items-center rounded-card border border-default bg-surface transition-all duration-200 hover:border-strong focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/50">
          <Search className="pointer-events-none ml-3 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <input
            id={`${idPrefix}-input`}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Preferred city for review — e.g. Mumbai"
            className="w-full bg-transparent px-2.5 py-2.5 text-sm text-primary outline-none placeholder:text-muted/70"
          />
          {loading && <Loader2 className="mr-3 h-4 w-4 shrink-0 animate-spin text-muted" aria-hidden="true" />}
          {!loading && query.trim() && (
            <button
              type="button"
              onClick={() => addCity(query)}
              title="Add exactly what you typed"
              className="mr-1.5 inline-flex shrink-0 items-center gap-1 rounded-btn bg-accent px-2.5 py-1.5 text-xs font-semibold text-on-brand transition-colors duration-150 hover:bg-accent-hover"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add
            </button>
          )}
        </div>

        {open && query.trim().length >= 2 && suggestions.length > 0 && (
          <ul className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-card border border-default bg-surface-raised shadow-lg">
            {suggestions.map((s) => (
              <li key={s.placeId}>
                <button
                  type="button"
                  onClick={() => addCity(s.city)}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-primary transition-colors duration-150 hover:bg-accent-subtle"
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{s.description}</span>
                  <Plus className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {cities.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {cities.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1.5 rounded-full border border-accent-border bg-accent-subtle py-1 pl-3 pr-1.5 text-xs font-semibold text-accent"
            >
              <MapPin className="h-3 w-3" aria-hidden="true" />
              {c}
              <button
                type="button"
                onClick={() => removeCity(c)}
                aria-label={`Remove ${c}`}
                className="rounded-full p-0.5 transition-colors duration-150 hover:bg-accent hover:text-on-brand"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-1.5 text-xs text-muted">
          Add at least one city — reviewers in any of the cities you add here will see this campaign.
        </p>
      )}
    </div>
  );
}
