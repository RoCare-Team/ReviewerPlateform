import Container from "./Container";

/**
 * Scrolling strip of the review platforms ReviewHub covers.
 *
 * To simulate authentic brand wordmarks without trademark SVGs, each platform
 * is styled with unique typographic attributes (font weight, tracking, casing, etc.).
 *
 * The list is rendered twice so the CSS marquee loops seamlessly.
 * Includes interactive pause-on-hover behavior and edge fades via native CSS masks.
 */
const PLATFORMS = [
  { name: "Google", className: "font-semibold tracking-tight" },
  { name: "Play Store", className: "font-bold tracking-tight" },
  { name: "App Store", className: "font-medium tracking-wide" },
  { name: "Trustpilot", className: "font-extrabold lowercase tracking-tighter text-[1.05em]" },
  { name: "AmbitionBox", className: "font-bold tracking-tight" },
  { name: "Glassdoor", className: "font-semibold tracking-normal lowercase" },
  { name: "Amazon", className: "font-black lowercase tracking-tighter" },
  { name: "Flipkart", className: "font-extrabold italic tracking-tight" },
  { name: "G2", className: "font-black uppercase tracking-widest text-[0.9em]" },
  { name: "Capterra", className: "font-normal tracking-widest uppercase text-[0.85em]" },
];

function Track({ hidden }) {
  return (
    <ul
      aria-hidden={hidden || undefined}
      // Hover/focus state halts the loop, giving users precise control to read the names
      className="marquee-track flex shrink-0 items-center gap-16 pr-16 transition-transform hover:[animation-play-state:paused] focus-within:[animation-play-state:paused]"
    >
      {PLATFORMS.map(({ name, className }) => (
        <li 
          key={name} 
          className={`whitespace-nowrap text-lg text-muted/60 transition-colors duration-200 hover:text-primary ${className}`}
        >
          {name}
        </li>
      ))}
    </ul>
  );
}

export default function LogoMarquee() {
  return (
    <section 
      aria-label="Supported review platforms" 
      className="border-y border-default/60 bg-surface-raised py-8 sm:py-10"
    >
      <Container>
        <p className="mb-6 text-center text-[10px] font-bold uppercase tracking-[0.15em] text-muted/80 sm:text-xs">
          Collect and track reviews across every platform that matters
        </p>
      </Container>
      
      {/* 
        Container with inline CSS mask-image. This guarantees a beautiful left-to-right 
        fade overlay even if global styles don't load, degrading gracefully on unsupported browsers.
      */}
      <div 
        className="marquee-mask relative flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,white_15%,white_85%,transparent)] [-webkit-mask-image:linear-gradient(to_right,transparent,white_15%,white_85%,transparent)]"
      >
        <Track />
        <Track hidden />
      </div>
    </section>
  );
}