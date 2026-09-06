import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Pixelify_Sans, Silkscreen, IBM_Plex_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { catalogue } from "@/lib/catalogue";
import { OWNER } from "@/lib/owner";
import { CalibrationProvider } from "@/components/Calibration";
import { Develop } from "@/components/Develop";
import { Reticle } from "@/components/Reticle";
import { Ground } from "@/components/Ground";
import { Boot } from "@/components/Boot";

/*
 * The reference build's four faces, in its roles. Body copy is mono, which is
 * most of why the page reads as a console; the serif is reserved for
 * one-sentence leads. See meridian/FOUNDRY-MATCH.md.
 */
const display = Pixelify_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const micro = Silkscreen({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-micro",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-mono",
  display: "swap",
});

const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Meridian — a self-classifying engineering portfolio",
  description:
    "An observatory for one account. Instruments read the repositories, measure them on five fixed axes, publish a catalogue, and revise it when the readings change. Every rank is computed; nothing is self-reported.",
  authors: [{ name: OWNER.name, url: OWNER.github }],
  openGraph: {
    title: "Meridian",
    description: "The record keeps itself. Every rank on this page is computed, not typed.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#100e0c" },
    { media: "(prefers-color-scheme: light)", color: "#f4f1e8" },
  ],
};

/*
 * Set the exposure before first paint. A stored preference wins; otherwise the
 * system preference decides. Inline, because a plate that flashes the wrong
 * ground is a worse failure than a few lines of script in the head.
 */
const PLATE_SCRIPT = `(function(){try{var s=localStorage.getItem("meridian.plate");var m=window.matchMedia("(prefers-color-scheme: light)").matches;document.documentElement.dataset.plate=(s==="day"||s==="night")?s:(m?"day":"night");}catch(e){document.documentElement.dataset.plate="night";}})();`;

/*
 * The page opens at the top, so a reload replays it from the beginning.
 *
 * Browsers default `history.scrollRestoration` to "auto", which puts you back
 * at your old offset after a refresh. On an ordinary page that is right. Here
 * it is not: the boot plate plays its whole sequence, lifts, and reveals plate
 * 07. The page announces itself and then opens halfway down, which reads as a
 * failure even though every part of it worked.
 *
 * It has to run before the browser restores, which is why it is inline and
 * beforeInteractive rather than an effect. Setting the flag is what prevents
 * the restore; the scroll only matters for a browser that restored anyway.
 *
 * ── What this costs, stated rather than glossed ─────────────────────────────
 * "manual" is sticky for the whole tab: once set, it governs every later
 * history traversal too, so pressing Back to return here also lands at the
 * top rather than where you were. An earlier cut of this script tried to
 * exempt back/forward by checking the navigation type — measured, that does
 * nothing, because by the time a traversal happens the flag is already set
 * from the load before it.
 *
 * That trade is worth it on a single page whose navigation is anchors: the
 * Index menu, the skip link and every #hash still land exactly where they
 * point, because a fragment navigation scrolls to its target and never
 * consults scrollRestoration.
 *
 * The one exemption is a URL that carries a hash. Someone who opened
 * /#catalogue asked for that plate by name, and the opening shot is not a
 * reason to overrule them.
 */
const SCROLL_SCRIPT = `(function(){try{if(location.hash)return;if("scrollRestoration"in history)history.scrollRestoration="manual";window.scrollTo(0,0);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const cat = catalogue();

  return (
    <html
      lang="en"
      data-plate="night"
      /*
       * The boot plate is up from the very first frame because the flag is in
       * the server-rendered markup, not set by a script afterwards.
       *
       * It was a `beforeInteractive` script; the tag reached the HTML but the
       * attribute never appeared, so the plate never showed. Rendering the
       * attribute directly removes the dependency on script ordering
       * altogether — there is no window in which the page is visible and then
       * covered, because the plate is in the first paint.
       *
       * `Boot` removes this once the page has loaded, and the <noscript> rule
       * below hides the plate when there is no script to remove it.
       */
      data-booting="1"
      className={`${display.variable} ${micro.variable} ${mono.variable} ${serif.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* beforeInteractive, so the exposure is chosen before the first paint
            rather than flashing the wrong ground and correcting itself */}
        <Script id="meridian-plate" strategy="beforeInteractive">
          {PLATE_SCRIPT}
        </Script>
        {/* before the browser can restore the old offset, so a refresh opens
            on the hero rather than wherever the reader had scrolled to */}
        <Script id="meridian-scroll" strategy="beforeInteractive">
          {SCROLL_SCRIPT}
        </Script>
        {/* without JavaScript nothing can dismiss the plate, so never show it */}
        <noscript>
          <style>{`[data-booting] .boot{display:none!important}`}</style>
        </noscript>
      </head>
      <body className="sky">
        <a className="skip" href="#first-light">
          Skip to the catalogue
        </a>
        {/* the boot plate sits above everything and lifts itself */}
        <Boot catalogued={cat.entries.length} />

        <CalibrationProvider>
          <Develop />
          <Ground lastRun={cat.generated} cat={cat.entries.length} />
          <Reticle lastRun={cat.generated} catalogued={cat.entries.length} />
          <main className="above">{children}</main>
        </CalibrationProvider>
      </body>
    </html>
  );
}
