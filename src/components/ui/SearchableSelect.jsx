"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";

/**
 * Generic searchable dropdown ("combobox") — a text field that opens a
 * panel with its own search box on top and a scrollable, keyboard-navigable
 * option list below. No external dependency; built for the state/city
 * picker (components/ui/StateCitySelect.jsx) but generic enough to reuse
 * anywhere a plain <select> would otherwise need to hold hundreds of options.
 *
 * The panel is portaled to <body> and positioned with `fixed` coordinates
 * read off the trigger button, exactly like ContactModal/ScreenshotViewer
 * portal past their ancestors. It's NOT optional here — this field lives
 * inside NewCampaignModal's scrollable body (`overflow-y-auto`), which
 * clips any plain `position: absolute` child that would render past its
 * bounds, cutting the panel off and letting the modal's own content bleed
 * through it. Portaling escapes that clipping entirely.
 *
 * Controlled: `value` is the selected option string (or "" for none),
 * `onChange` fires with the new value. `options` is the full list; typing in
 * the search box filters it client-side.
 */
export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyMessage = "No matches.",
  icon: Icon,
  disabled = false,
  id,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [coords, setCoords] = useState(null); // { top, left, width } in viewport px
  const rootRef = useRef(null);
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);
  const reactId = useId();
  const inputId = id || reactId;
  const listboxId = `${inputId}-listbox`;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  function reposition() {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Flip above the trigger when there isn't enough room below — same
    // "does it fit" check a native <select> does for you for free.
    const panelHeight = panelRef.current?.offsetHeight ?? 320;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < panelHeight + 12 && rect.top > panelHeight;
    setCoords({
      left: rect.left,
      width: rect.width,
      top: openUpward ? rect.top - 6 : rect.bottom + 6,
      openUpward,
    });
  }

  // Position before paint (no flash at the wrong spot), then keep it glued
  // to the trigger through scrolling/resizing anywhere in the page —
  // including inside the modal's own scrollable body.
  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click / Escape — the same pattern the other modals in
  // this app use (ContactModal, NewCampaignModal). Outside-click has to
  // check the portaled panel too, since it no longer lives under rootRef.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (rootRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Focus the search box the moment the panel opens, and reset to a fresh
  // search each time — reopening should never show a stale filter.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(Math.max(0, options.indexOf(value)));
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function select(option) {
    onChange(option);
    setOpen(false);
  }

  function onSearchKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[activeIndex]) select(filtered[activeIndex]);
    }
  }

  // Keep the active option scrolled into view during keyboard navigation.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children[activeIndex];
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  return (
    <div ref={rootRef} className="group relative">
      {Icon && (
        <Icon
          className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted transition-colors duration-200 group-focus-within:text-accent"
          aria-hidden="true"
        />
      )}
      <button
        ref={btnRef}
        type="button"
        id={inputId}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center justify-between rounded-btn border border-default bg-surface py-2.5 pr-3 text-left text-primary outline-none transition-all duration-200 hover:border-strong focus:border-accent focus:ring-2 focus:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-60 ${
          Icon ? "pl-10" : "pl-3"
        }`}
      >
        <span className={`truncate ${value ? "" : "text-muted/70"}`}>{value || placeholder}</span>
        <ChevronDown
          className={`ml-2 h-4 w-4 shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            className="animate-fade-up fixed z-100 overflow-hidden rounded-card border border-default bg-surface-raised shadow-lg"
            style={{
              top: coords ? coords.top : 0,
              left: coords ? coords.left : 0,
              width: coords ? coords.width : undefined,
              transform: coords?.openUpward ? "translateY(-100%)" : undefined,
              visibility: coords ? "visible" : "hidden",
              animationDuration: "150ms",
            }}
          >
            <div className="relative border-b border-default">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={onSearchKeyDown}
                placeholder={searchPlaceholder}
                role="combobox"
                aria-controls={listboxId}
                aria-expanded="true"
                className="w-full bg-surface-raised py-2.5 pl-9 pr-8 text-sm text-primary outline-none placeholder:text-muted/70"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted transition-colors duration-150 hover:bg-surface-sunken hover:text-primary"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            <ul ref={listRef} id={listboxId} role="listbox" className="max-h-56 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <li className="px-3.5 py-3 text-center text-sm text-muted">{emptyMessage}</li>
              ) : (
                filtered.map((option, i) => (
                  <li
                    key={option}
                    role="option"
                    aria-selected={option === value}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => select(option)}
                    className={`flex cursor-pointer items-center justify-between px-3.5 py-2 text-sm transition-colors duration-100 ${
                      i === activeIndex ? "bg-accent-subtle text-accent" : "text-primary hover:bg-surface-sunken"
                    }`}
                  >
                    <span className="truncate">{option}</span>
                    {option === value && <Check className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />}
                  </li>
                ))
              )}
            </ul>
          </div>,
          document.body
        )}
    </div>
  );
}
