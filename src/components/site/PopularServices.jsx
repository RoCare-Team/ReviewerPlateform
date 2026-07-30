import Image from "next/image";
import Link from "next/link";
import Container from "./Container";
import { getCities } from "../../lib/cities";

/**
 * "Popular Review Services" — an auto-scrolling marquee of city cards. Each card
 * is a photo + city name and links to its /services/[city] detail page. Data
 * comes from src/lib/cities.js so the cards and the detail pages can't drift.
 *
 * The track is rendered twice and animated with the shared `marquee-track`
 * utility (globals.css), which translates -50% for a seamless loop. Hover pauses
 * it; reduced-motion users get a static row.
 */

// One copy of the card row. The second copy is aria-hidden so the loop reads as
// a single list to assistive tech.
function Track({ cities, hidden }) {
  return (
    <ul
      aria-hidden={hidden || undefined}
      className="marquee-track flex shrink-0 items-stretch gap-5 pr-5 transition-transform hover:[animation-play-state:paused] focus-within:[animation-play-state:paused]"
    >
      {cities.map((city) => (
        <li key={city.slug} className="shrink-0">
          <Link
            href={`/services/${city.slug}`}
            tabIndex={hidden ? -1 : undefined}
            className="group block w-60 overflow-hidden rounded-card border border-default bg-surface-raised shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <div className="relative h-40">
              <Image
                src={city.image}
                alt={city.name}
                fill
                sizes="240px"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <p className="px-4 py-3 text-center text-base font-bold text-primary">{city.name}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function PopularServices() {
  const cities = getCities();

  return (
    <section id="popular" className="py-20 sm:py-24 bg-background">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-accent">Popular</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-primary sm:text-4xl lg:text-[2.5rem] lg:leading-[1.15]">
            Review services in top cities
          </h2>
          <p className="mt-4 mx-auto max-w-2xl text-base leading-relaxed text-secondary sm:text-lg">
            Explore where businesses collect verified customer reviews with ReviewHub.
          </p>
        </div>
      </Container>

      {/* Auto-scrolling marquee — track duplicated for a seamless -50% loop. */}
      <div className="marquee-mask relative mt-12 flex overflow-hidden py-2">
        <Track cities={cities} />
        <Track cities={cities} hidden />
      </div>
    </section>
  );
}
