"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Scroll-reveal wrapper. Fades + lifts its children in the first time they
 * enter the viewport, then stops observing (reveals never replay — a card that
 * re-animates every scroll pass is noise, not polish).
 *
 * Deliberately progressive: the server-rendered markup carries NO hidden state,
 * and the `.reveal` class is only attached from a layout effect. So if JS never
 * runs, or an old browser lacks IntersectionObserver, the content is simply
 * visible — the animation is the enhancement, never the gate.
 *
 * `delay` staggers siblings in a grid (pass the map index * ~70ms). Honours
 * prefers-reduced-motion: those users get the content with no transition, since
 * globals.css section 5 already zeroes the duration.
 */

// useLayoutEffect warns during SSR; there is no layout to read on the server, so
// fall back to useEffect there.
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export default function Reveal({
  as: Tag = "div",
  delay = 0,
  className = "",
  children,
  ...rest
}) {
  const ref = useRef(null);
  const [armed, setArmed] = useState(false);

  // Arm before paint so the element is never seen in its final position first.
  useIsomorphicLayoutEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    setArmed(true);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!armed || !el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.classList.add("is-visible");
        observer.disconnect();
      },
      // Fire a little before the element is fully on screen, so the motion has
      // finished by the time the user is actually reading it.
      { threshold: 0.1, rootMargin: "0px 0px -60px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [armed]);

  return (
    <Tag
      ref={ref}
      className={`${armed ? "reveal " : ""}${className}`}
      style={armed && delay ? { "--reveal-delay": `${delay}ms` } : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}
