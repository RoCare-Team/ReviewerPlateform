/**
 * Popular cities where ReviewHub runs verified-review campaigns. Single source
 * of truth for both the homepage "Popular Review Services" cards and the
 * /services/[city] detail pages, so the list and the pages can never drift.
 *
 * Compliance: copy stays participation-framed — figures describe verified
 * PARTICIPATION and business coverage, never volume of positive ratings.
 * `image` is a real 1000×600 city photo in public/img/cities/. `gradient` is
 * kept as an overlay tint over the photo (and a fallback background while it
 * loads), a pair of Tailwind color stops.
 */
const CITIES = [
  {
    slug: "mumbai",
    image: "/img/cities/mumbai.jpg",
    name: "Mumbai",
    region: "Maharashtra",
    emoji: "🌆",
    gradient: "from-indigo-500 to-violet-600",
    tagline: "India's busiest review market",
    businesses: "3,200+",
    avgRating: "4.6",
    platforms: ["Google", "Zomato", "Trustpilot", "Amazon"],
    blurb:
      "From Bandra cafés to Andheri service centres, Mumbai businesses use ReviewHub to collect verified customer feedback across every major platform.",
  },
  {
    slug: "delhi",
    image: "/img/cities/delhi.jpg",
    name: "Delhi NCR",
    region: "Delhi",
    emoji: "🏛️",
    gradient: "from-rose-500 to-orange-500",
    tagline: "Capital-region reputation, done right",
    businesses: "2,800+",
    avgRating: "4.5",
    platforms: ["Google", "Play Store", "Glassdoor", "Flipkart"],
    blurb:
      "Retailers, clinics and D2C brands across Delhi NCR run participation-based campaigns and monitor results from a single dashboard.",
  },
  {
    slug: "bengaluru",
    image: "/img/cities/bengaluru.jpg",
    name: "Bengaluru",
    region: "Karnataka",
    emoji: "💻",
    gradient: "from-emerald-500 to-teal-600",
    tagline: "The SaaS & startup review hub",
    businesses: "2,400+",
    avgRating: "4.7",
    platforms: ["G2", "Capterra", "Google", "Play Store"],
    blurb:
      "Bengaluru's software and services companies lean on G2 and Capterra coverage with screenshot-verified feedback that stands up to scrutiny.",
  },
  {
    slug: "hyderabad",
    image: "/img/cities/hyderabad.jpg",
    name: "Hyderabad",
    region: "Telangana",
    emoji: "🕌",
    gradient: "from-sky-500 to-blue-600",
    tagline: "Fast-growing reviews across HITEC City",
    businesses: "1,900+",
    avgRating: "4.6",
    platforms: ["Google", "Amazon", "App Store", "Trustpilot"],
    blurb:
      "Hyderabad businesses — from HITEC City IT to local services — collect authentic feedback and reward reviewers for verified participation.",
  },
  {
    slug: "pune",
    image: "/img/cities/pune.jpg",
    name: "Pune",
    region: "Maharashtra",
    emoji: "🎓",
    gradient: "from-fuchsia-500 to-pink-600",
    tagline: "Education & auto reputation leaders",
    businesses: "1,500+",
    avgRating: "4.5",
    platforms: ["Google", "AmbitionBox", "Glassdoor", "Justdial"],
    blurb:
      "Pune's education, automotive and IT firms track employer and customer reputation with AmbitionBox and Glassdoor monitoring built in.",
  },
  {
    slug: "chennai",
    image: "/img/cities/chennai.jpg",
    name: "Chennai",
    region: "Tamil Nadu",
    emoji: "🌊",
    gradient: "from-cyan-500 to-emerald-600",
    tagline: "Trusted feedback across the south",
    businesses: "1,300+",
    avgRating: "4.6",
    platforms: ["Google", "Amazon", "Flipkart", "Play Store"],
    blurb:
      "Chennai retailers and service providers grow trust with verified reviews and transparent, participation-only rewards.",
  },
];

export function getCities() {
  return CITIES;
}

export function getCity(slug) {
  return CITIES.find((c) => c.slug === slug) ?? null;
}

export function getCitySlugs() {
  return CITIES.map((c) => c.slug);
}
