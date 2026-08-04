"use client";

import Image from "next/image";
import { useState } from "react";
import { X, ZoomIn } from "lucide-react";

/**
 * Thumbnail that opens the full-size screenshot in an in-page modal instead
 * of a new tab — used anywhere a review-proof screenshot is shown (admin
 * verification queue, reviewer's own submission history, ...) so viewing
 * proof never loses the surrounding list/scroll position.
 */
export default function ScreenshotViewer({ url, alt = "Screenshot proof", size = 64 }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group/shot relative shrink-0 rounded-btn focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        aria-label="View screenshot proof"
      >
        <Image
          src={url}
          alt={alt}
          width={size}
          height={size}
          style={{ width: size, height: size }}
          className="rounded-btn border border-default object-cover transition-all duration-200 group-hover/shot:opacity-80 group-hover/shot:brightness-95"
          unoptimized
        />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-btn bg-surface-inverse/0 opacity-0 transition-all duration-200 group-hover/shot:bg-surface-inverse/20 group-hover/shot:opacity-100">
          <ZoomIn className="h-5 w-5 text-white drop-shadow" aria-hidden="true" />
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          className="animate-fade-up fixed inset-0 z-50 flex items-center justify-center bg-surface-inverse/60 p-4 backdrop-blur-sm"
          style={{ animationDuration: "200ms" }}
          onClick={() => setOpen(false)}
        >
          <div className="relative max-h-[90vh] max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-surface-raised text-primary shadow-md transition-all duration-200 hover:scale-110 hover:bg-surface-sunken"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <Image
              src={url}
              alt={`${alt}, full size`}
              width={960}
              height={960}
              className="max-h-[90vh] w-auto rounded-card border border-default object-contain shadow-lg"
              unoptimized
            />
          </div>
        </div>
      )}
    </>
  );
}
