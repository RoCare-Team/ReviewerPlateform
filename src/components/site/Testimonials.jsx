"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, MessageSquarePlus, Quote, Star } from "lucide-react";
import Container from "./Container";
import Reveal from "./Reveal";
import LeaveReviewModal from "../models/LeaveReviewModal";

/**
 * Social proof. STATIC_QUOTES are illustrative placeholders — swap for real,
 * consented quotes before launch. Do NOT add Review/AggregateRating schema
 * here until the quotes are genuine and you can stand behind the numbers:
 * fake rating markup is a manual-action risk and undercuts the whole
 * "honest reviews" positioning.
 * `avatarUrl` is optional — falls back to initials where no photo is set.
 *
 * Real visitor submissions come from the "Leave a review" modal, land in the
 * Testimonial collection auto-approved (see src/models/Testimonial.js), and
 * are fetched here client-side so they show up immediately without a
 * redeploy — they're prepended ahead of the static placeholders.
 */
const STATIC_QUOTES = [
  {
    quote: "We finally see every Google and Trustpilot review in one dashboard, and the verification means we trust what we're reading. Our response time dropped from days to hours.",
    name: "Ananya Rao",
    role: "Marketing Lead, Urban Cafe Co.",
    avatarUrl: "https://randomuser.me/api/portraits/women/15.jpg",
    rating: 5,
  },
  {
    quote: "The fraud checks are the real deal. Duplicate screenshots and recycled reviews get flagged before they ever reach us — that alone paid for the plan.",
    name: "Vikram Shah",
    role: "Founder, MetricLabs",
    avatarUrl: "https://randomuser.me/api/portraits/men/12.jpg",
    rating: 5,
  },
  {
    quote: "As a reviewer, I like that I'm rewarded for actually participating, not for lying. Upload the proof, it gets checked, points land. Simple and fair.",
    name: "Priya Nair",
    role: "Verified reviewer",
    avatarUrl: "https://randomuser.me/api/portraits/women/22.jpg",
    rating: 5,
  },
];

function Avatar({ name, avatarUrl }) {
  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={name}
        width={40}
        height={40}
        className="h-10 w-10 shrink-0 rounded-full border border-default object-cover shadow-inner"
      />
    );
  }

  const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("");
  return (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent/20 bg-accent/10 text-sm font-bold text-accent shadow-inner transition-colors duration-300 group-hover:bg-accent group-hover:text-on-brand group-hover:border-transparent"
    >
      {initials}
    </span>
  );
}

export default function Testimonials() {
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [liveQuotes, setLiveQuotes] = useState([]);
  const [isPaused, setIsPaused] = useState(false);
  const trackRef = useRef(null);

  const loadReviews = () => {
    fetch("/api/testimonials")
      .then((res) => res.json())
      .then((data) => setLiveQuotes(Array.isArray(data.testimonials) ? data.testimonials : []))
      .catch(() => {}); // static quotes still render if this fails
  };

  useEffect(() => {
    loadReviews();
  }, []);

  const quotes = [...liveQuotes, ...STATIC_QUOTES];
  const scrollTrack = (direction) => {
    trackRef.current?.scrollBy({ left: direction * 340, behavior: "smooth" });
  };

  // Auto-scroll — advances one card every few seconds and loops back to the
  // start once it runs out of room to scroll. Paused on hover/touch so it
  // never fights a visitor who's actually reading or dragging the row, and
  // paused whenever the tab isn't visible so it doesn't burn a scroll queue
  // in the background.
  useEffect(() => {
    if (isPaused || quotes.length < 2) return undefined;

    const id = setInterval(() => {
      const track = trackRef.current;
      if (!track || document.hidden) return;

      const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 8;
      if (atEnd) {
        track.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        track.scrollBy({ left: 340, behavior: "smooth" });
      }
    }, 3500);

    return () => clearInterval(id);
  }, [isPaused, quotes.length]);

  return (
    // Section spacing optimized to the requested compact rhythm (py-8 sm:py-12)
    <section id="testimonials" className="py-8 sm:py-12 bg-background">
      <Container>
        {/* Header Block to maintain typographic alignment across sections */}
        <Reveal className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-widest text-accent">
              Social Proof
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-primary sm:text-4xl lg:text-[2.5rem] lg:leading-[1.15]">
              Trusted by businesses and reviewers alike
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-secondary sm:text-lg">
              Reputation you can defend, because every review behind it was verified.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsReviewModalOpen(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-btn bg-accent px-5 py-3 text-sm font-semibold text-on-brand shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-md"
          >
            <MessageSquarePlus className="h-4.5 w-4.5" aria-hidden="true" />
            Leave a review
          </button>
        </Reveal>

        {/* Testimonials — horizontal scroll row rather than a fixed grid, so
            new visitor-submitted reviews just extend the row instead of
            needing a new grid breakpoint. Arrow buttons drive the scroll;
            the native scrollbar is hidden so it reads as a carousel. */}
        <div className="mt-14 flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollTrack(-1)}
            aria-label="Scroll reviews left"
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-default bg-surface text-secondary transition-colors hover:border-accent/40 hover:text-primary sm:flex"
          >
            <ChevronLeft className="h-4.5 w-4.5" aria-hidden="true" />
          </button>

          <ul
            ref={trackRef}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onTouchStart={() => setIsPaused(true)}
            onTouchEnd={() => setIsPaused(false)}
            onFocus={() => setIsPaused(true)}
            onBlur={() => setIsPaused(false)}
            className="scrollbar-none flex flex-1 snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth pb-2"
          >
            {quotes.map((t, i) => (
              <Reveal
                as="li"
                key={t._id ?? t.name}
                delay={Math.min(i, 5) * 110}
                className="w-[85%] shrink-0 snap-start sm:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)]"
              >
                <div className="group relative flex h-full flex-col overflow-hidden rounded-card border border-default/60 bg-surface-raised p-6 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-accent/40 hover:shadow-lg">
                  <div className="card-sheen" aria-hidden="true" />

                  {/* Watermark quote glyph — decorative depth behind the text */}
                  <Quote
                    className="pointer-events-none absolute -right-3 -top-3 h-20 w-20 rotate-12 text-accent/5 transition-all duration-500 group-hover:rotate-6 group-hover:text-accent/10"
                    aria-hidden="true"
                  />

                  {/* Star Rating Panel (Standardized to high-trust amber colors) */}
                  <div className="flex gap-0.5" aria-label={`${t.rating ?? 5} out of 5 stars`}>
                    {[0, 1, 2, 3, 4].map((s) => (
                      <Star
                        key={s}
                        className={`h-4 w-4 transition-transform duration-300 group-hover:scale-110 ${
                          s < (t.rating ?? 5) ? "fill-amber-400 text-amber-400" : "text-muted"
                        }`}
                        style={{ transitionDelay: `${s * 40}ms` }}
                        aria-hidden="true"
                      />
                    ))}
                  </div>

                  {/* Quote Block with standard line spacing and elegant italic typography */}
                  <blockquote className="mt-4 flex-1 text-sm italic leading-relaxed text-secondary sm:text-base">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>

                  {/* User Metadata Footer with a clean separator layout */}
                  <div className="mt-6 flex items-center gap-3 border-t border-default/50 pt-4">
                    <Avatar name={t.name} avatarUrl={t.avatarUrl} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-primary">{t.name}</div>
                      <div className="truncate text-xs text-muted">{t.role || "Verified user"}</div>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => scrollTrack(1)}
            aria-label="Scroll reviews right"
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-default bg-surface text-secondary transition-colors hover:border-accent/40 hover:text-primary sm:flex"
          >
            <ChevronRight className="h-4.5 w-4.5" aria-hidden="true" />
          </button>
        </div>
      </Container>

      <LeaveReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        onSubmitted={loadReviews}
      />
    </section>
  );
}