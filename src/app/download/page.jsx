import Image from "next/image";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Apple, Smartphone } from "lucide-react";
import Container from "../../components/site/Container";
import SiteHeader from "../../components/site/SiteHeader";
import SiteFooter from "../../components/site/SiteFooter";
import { getStoreLinks, platformFromUserAgent, storeUrlFor } from "../../lib/storeLinks";

/**
 * The one link to share: /download sends an iPhone to the App Store and an
 * Android phone to Play, and shows both buttons to everyone else.
 *
 * A page rather than a route handler because of that "everyone else": desktop
 * visitors and link-preview crawlers are a real share of the traffic on an
 * install link, and they deserve the site's own page rather than a bare 307
 * into a store that will only tell them to open it on a phone.
 *
 * See lib/storeLinks.js for the platform decision, why bots are never
 * redirected, and what this is NOT (a Universal Link that opens an app
 * already installed).
 */
export const metadata = {
  title: "Get the RapportLook app",
  description:
    "Download RapportLook for iPhone or Android — earn rewards for verified reviews, or manage your business's review campaigns on the move.",
  alternates: { canonical: "/download" },
  openGraph: {
    title: "Get the RapportLook app",
    description: "One link for both stores — opens the App Store on iPhone and Google Play on Android.",
    url: "/download",
  },
};

// The whole point of this route is that it answers differently per request.
// headers() already forces dynamic rendering; saying so explicitly keeps a
// future "let's prerender the marketing pages" change from silently freezing
// one platform's link into the HTML for everyone.
export const dynamic = "force-dynamic";

export default async function DownloadPage({ searchParams }) {
  const { ref = "" } = (await searchParams) ?? {};
  const ua = (await headers()).get("user-agent");
  const links = await getStoreLinks();

  const platform = platformFromUserAgent(ua);
  // Outside any try/catch — redirect() works by throwing.
  if (platform) redirect(storeUrlFor(platform, links, ref));

  const code = String(ref || "").trim();

  return (
    <>
      <SiteHeader />

      <main className="bg-background">
        <section className="py-16 sm:py-24">
          <Container className="max-w-2xl text-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-subtle">
              <Smartphone className="h-7 w-7 text-accent" aria-hidden="true" />
            </span>

            <h1 className="mt-6 text-3xl font-bold tracking-tight text-primary sm:text-4xl">
              Get the RapportLook app
            </h1>
            <p className="mt-4 text-base leading-relaxed text-secondary sm:text-lg">
              Open this page on your phone and it takes you straight to the right store. On a computer, pick yours
              below.
            </p>

            {code && (
              <p className="mt-4 inline-block rounded-btn border border-accent-border bg-accent-subtle px-4 py-2 text-sm text-secondary">
                Invite code <span className="font-bold text-primary">{code}</span> — enter it when you sign up.
              </p>
            )}

            <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
              <a
                href={storeUrlFor("android", links, code)}
                className="group inline-flex items-center justify-center gap-3 rounded-card border border-default bg-surface-raised px-6 py-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md"
              >
                <Image src="/google-play.png" alt="" width={28} height={28} className="h-7 w-7 object-contain" />
                <span className="text-left">
                  <span className="block text-[11px] uppercase tracking-wide text-muted">Get it on</span>
                  <span className="block text-base font-bold text-primary">Google Play</span>
                </span>
              </a>

              <a
                href={links.ios}
                className="group inline-flex items-center justify-center gap-3 rounded-card border border-default bg-surface-raised px-6 py-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md"
              >
                {/* Apple's own badge artwork carries licence terms, so this is
                    a neutral glyph rather than the official badge — and not the
                    U+F8FF Apple character either, which renders as a blank box
                    on every non-Apple device, i.e. most of the desktop visitors
                    this page exists for. */}
                <Apple className="h-7 w-7 text-primary" aria-hidden="true" />
                <span className="text-left">
                  <span className="block text-[11px] uppercase tracking-wide text-muted">Download on the</span>
                  <span className="block text-base font-bold text-primary">App Store</span>
                </span>
              </a>
            </div>

            <p className="mt-8 text-sm text-muted">
              iPhone and iPad need iOS 15 or later. Android needs 8.0 or later.
            </p>
          </Container>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
