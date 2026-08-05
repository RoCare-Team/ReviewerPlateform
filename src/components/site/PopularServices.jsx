import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import Container from "./Container";
import Reveal from "./Reveal";
import { getCities } from "../../lib/cities";

/**
 * "Popular Review Services" — an auto-scrolling marquee of city cards. Each card
 * is a photo + city name and links to its /services/[city] detail page. Data
 * comes from src/lib/cities.js so the cards and the detail pages can't drift.
 *
 * The track is rendered twice and both copies sit inside ONE animated wrapper
 * (the `marquee-track` utility from globals.css), which translates the whole
 * pair -50% for a seamless loop. The animation and its hover-pause MUST live
 * on that shared wrapper, not on each copy individually — two independently
 * animated/paused copies drift out of sync the moment only one of them is
 * hovered, which is what made the scroll look janky. Reduced-motion users get
 * a static row.
 */

// One copy of the card row. The second copy is aria-hidden so the loop reads as
// a single list to assistive tech.
function Track({ cities, hidden }) {
  return (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-stretch gap-5 pr-5">
      {cities.map((city) => (
        <li key={city.slug} className="shrink-0">
          <Link
            href={`/services/${city.slug}`}
            tabIndex={hidden ? -1 : undefined}
            className="group block w-60 overflow-hidden rounded-card border border-default bg-surface-raised shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-accent/40 hover:shadow-xl hover:shadow-accent/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <div className="relative h-40 overflow-hidden">
              <Image
                src={city.image}
                alt={city.name}
                fill
                sizes="240px"
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
              />
              {/* Gradient scrim deepens on hover — keeps the label legible over
                  any photo and gives the card a sense of depth. */}
              <div
                className="absolute inset-0 bg-linear-to-t from-black/45 via-transparent to-transparent opacity-70 transition-opacity duration-300 group-hover:opacity-100"
                aria-hidden="true"
              />
            </div>
            <p className="flex items-center justify-center gap-1.5 px-4 py-3 text-center text-base font-bold text-primary transition-colors duration-300 group-hover:text-accent">
              {city.name}
              <ArrowUpRight
                className="h-4 w-4 -translate-x-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
                aria-hidden="true"
              />
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function PopularServices() {
  const cities = getCities();

  return (
    <section id="popular" className="py-8 sm:py-10 bg-background">
      <Container>
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-accent">Popular</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-primary sm:text-4xl lg:text-[2.5rem] lg:leading-[1.15]">
            Review services in top cities
          </h2>
          <p className="mt-4 mx-auto max-w-2xl text-base leading-relaxed text-secondary sm:text-lg">
            Explore where businesses collect verified customer reviews with ReviewHub.
          </p>
        </Reveal>
      </Container>

      {/* Auto-scrolling marquee — track duplicated for a seamless -50% loop.
          Animation + hover/focus pause live on THIS wrapper so both copies
          always move (and pause) together, never independently. */}
      <div className="marquee-mask relative mt-12 overflow-hidden py-2">
        <div className="marquee-track flex transition-transform hover:[animation-play-state:paused] focus-within:[animation-play-state:paused]">
          <Track cities={cities} />
          <Track cities={cities} hidden />
        </div>
      </div>
    </section>
  );
}
