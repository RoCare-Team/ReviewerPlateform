"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";

/**
 * Meta (Facebook) Pixel — ad attribution for the marketing site.
 *
 * The ID is not a secret: it ships inside the snippet below to every visitor's
 * browser either way, so it's inlined here rather than hidden behind an env
 * var that would have to be set on every environment for the pixel to work at
 * all (same reasoning as the Google site-verification token in app/layout.jsx).
 *
 * `afterInteractive` — the pixel is an analytics tag, not something the page
 * needs in order to render, but it does need to run on every page view rather
 * than only when the browser is idle (`lazyOnload` would drop events for
 * anyone who bounces quickly).
 *
 * ★ The base snippet fires exactly one PageView, on the browser's first load.
 * Every navigation after that is a client-side route change — no new document,
 * so no new snippet, and Meta would see a multi-page visit as a single page
 * view. The effect below fires the missing ones, skipping the very first
 * render so that initial view isn't counted twice. Only the pathname is
 * watched: reading search params here would force every static page in the
 * app under a Suspense boundary for no attribution benefit.
 */
const PIXEL_ID = "2124278271837037";

export default function MetaPixel() {
  const pathname = usePathname();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    window.fbq?.("track", "PageView");
  }, [pathname]);

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${PIXEL_ID}');
fbq('track', 'PageView');`}
      </Script>

      {/* Fallback for scripting-disabled browsers — a plain tracking pixel. */}
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
