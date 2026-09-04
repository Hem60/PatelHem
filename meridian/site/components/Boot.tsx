"use client";

/**
 * The boot sequence.
 *
 * A full-screen plate that holds while the page actually finishes loading,
 * then lifts. Matched to the reference build's opening: corner brackets, a
 * pixel wordmark, a serif line, a labelled progress bar and a skip.
 *
 * ── The bar measures real work ──────────────────────────────────────────────
 * This is the whole difference. A boot screen is normally a timer dressed as a
 * progress bar: it counts to 100 on a `setInterval` and the number means
 * nothing. On a page whose entire argument is that its figures are measured,
 * shipping a fake percentage would be the most visible lie on the site.
 *
 * So each step resolves on a real browser event:
 *
 *   catalogue   the data is inlined at build time — already here, so it
 *               completes immediately and says so
 *   typefaces   document.fonts.ready — genuinely the slow one, four families
 *   instruments React has hydrated, which is what makes the page interactive
 *   field       window "load": the lattice canvases and everything else
 *
 * ── The one concession ─────────────────────────────────────────────────────
 * There IS a minimum on-screen time, and an earlier cut of this file argued
 * against one. That argument was half right. Faking PROGRESS would be a lie:
 * a bar that crawls while the page sits ready is inventing work. Holding a
 * finished plate for a beat is not — the bar reads 100%, the label reads
 * READY, and nothing claims to still be loading.
 *
 * Without it a warm reload lifted in under a second and the boot appeared not
 * to run at all, which is a worse outcome than a short deliberate pause.
 *
 * It runs on every load, including a refresh. An earlier cut remembered the
 * visit in sessionStorage and skipped the plate on a reload, which was the
 * wrong behaviour: the boot is the page's opening shot, and a refresh that
 * goes straight to the hero looks like it failed to run.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { OWNER } from "@/lib/owner";
import { Graticule } from "./Ground";
import { Lattice } from "./Lattice";

/**
 * How long the plate stays up at minimum.
 *
 * Long enough for the entrance to finish AND be read.
 *
 * This has moved twice. 2600ms was too slow and felt like a gate; 1300ms was
 * quick enough that the sweep was still finishing as the shutter began, so
 * the plate read as a flicker rather than a sequence. The entrance now lands
 * at about 1250ms and this holds it a further ~650ms at full opacity — the
 * pause is what makes it look deliberate instead of rushed.
 *
 * Measured from navigation, so it is the time a reader actually sees, not the
 * time after hydration. The bar underneath still reports real completion; this
 * only governs when a FINISHED plate lifts.
 */
const MIN_ON_SCREEN = 1900;

/** Each step, with the share of the bar it is worth. */
const STEPS = [
  { id: "catalogue", label: "Catalogue", weight: 0.15 },
  { id: "typefaces", label: "Typefaces", weight: 0.35 },
  { id: "instruments", label: "Instruments", weight: 0.25 },
  { id: "field", label: "Field", weight: 0.25 },
] as const;

export function Boot({ catalogued }: { catalogued: number }) {
  /*
   * Whether this reader is booting is decided by an inline script before the
   * first paint (see layout.tsx) and carried on `<html data-booting>`. The
   * markup below always renders; CSS shows it only when that flag is set, so
   * there is no frame in which the page is visible and then covered.
   */
  const [booting, setBooting] = useState(false);
  const [done, setDone] = useState<string[]>([]);
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<number | null>(null);

  const dismiss = useCallback(() => {
    setLeaving(true);
    /* must outlast the exit animation, or the plate vanishes mid-wipe */
    timer.current = window.setTimeout(() => {
      delete document.documentElement.dataset.booting;
      setBooting(false);
    }, 520);
  }, []);

  useEffect(() => {
    /* a reader who asked for reduced motion never sees it — lift immediately */
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      delete document.documentElement.dataset.booting;
      return;
    }
    setBooting(document.documentElement.dataset.booting === "1");
  }, []);

  /* the real milestones */
  useEffect(() => {
    if (!booting) return;
    let live = true;
    const mark = (id: string) => {
      if (live) setDone((prev) => (prev.includes(id) ? prev : [...prev, id]));
    };

    /* inlined at build time — it is already in the markup being read */
    mark("catalogue");

    void document.fonts.ready.then(() => mark("typefaces"));

    /* this effect running IS hydration; a frame later the tree is painted */
    const frame = requestAnimationFrame(() => mark("instruments"));

    if (document.readyState === "complete") mark("field");
    else window.addEventListener("load", () => mark("field"), { once: true });

    return () => {
      live = false;
      cancelAnimationFrame(frame);
    };
  }, [booting]);

  /* lift once every step has actually reported, and not before the plate has
     been on screen long enough to have been seen */
  useEffect(() => {
    if (!booting) return;
    if (done.length < STEPS.length) return;
    /*
     * Measured from navigation, not from hydration.
     *
     * `performance.now()` is already milliseconds since the page started
     * loading, and the plate is server-rendered — so it has been on screen
     * that whole time. Timing from the effect instead added however long
     * hydration took on top of the hold, which in development pushed a 1.3s
     * minimum out to nearly three seconds.
     */
    const held = performance.now();
    const id = window.setTimeout(dismiss, Math.max(260, MIN_ON_SCREEN - held));
    return () => window.clearTimeout(id);
  }, [done, booting, dismiss]);

  /*
   * Failsafe. If a milestone never fires — a font request that hangs, say —
   * the plate would sit there forever with no way past it but the skip. Six
   * seconds and it lifts regardless. This is not a fake progress bar: the
   * percentage still shows exactly what completed.
   */
  useEffect(() => {
    if (!booting) return;
    const id = window.setTimeout(dismiss, 6000);
    return () => window.clearTimeout(id);
  }, [booting, dismiss]);

  /* click anywhere, or Enter / Escape */
  useEffect(() => {
    if (!booting) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [booting, dismiss]);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const pct = Math.round(
    STEPS.reduce((sum, s) => sum + (done.includes(s.id) ? s.weight : 0), 0) * 100,
  );
  const current = STEPS.find((s) => !done.includes(s.id));

  return (
    <div
      className="boot"
      data-leaving={leaving}
      onClick={dismiss}
      role="status"
      aria-live="polite"
      aria-label={`Loading, ${pct} per cent`}
    >
      {/*
        * The hero's ground, so the page does not change material when the
        * plate lifts: the same grid paper behind, the same lattice band along
        * the bottom. The boot reads as the first frame of the page rather than
        * as a separate screen in front of it.
        */}
      <Graticule />

      {/*
        * The exposure sweep — the one thing on this plate that is Meridian's
        * and nobody else's. The site's whole vocabulary is photographic: plates,
        * exposures, developing. So the boot develops. A single band travels the
        * height of the screen once, and each block resolves as it passes.
        */}
      <span className="boot__scan" aria-hidden="true" />

      {/* corner brackets: four rules, no image */}
      <span className="boot__corner" data-at="tl" aria-hidden="true" />
      <span className="boot__corner" data-at="tr" aria-hidden="true" />
      <span className="boot__corner" data-at="bl" aria-hidden="true" />
      <span className="boot__corner" data-at="br" aria-hidden="true" />

      <div className="boot__inner">
        <p className="boot__eyebrow boot__dev" style={{ ["--dev" as string]: "0" }}>
          <span className="boot__pip" aria-hidden="true" />
          Meridian · boot sequence · {OWNER.handle}
        </p>

        {/*
          * The wordmark develops one character at a time.
          *
          * Split into cells rather than animated as a block so each glyph can
          * carry its own delay — a pixel display warming up, which is what the
          * face is imitating anyway. The stagger is 34ms, so the whole mark
          * resolves in about 500ms and the eye reads it as one motion rather
          * than fifteen.
          */}
        <h1 className="boot__mark t-display" aria-label={`${OWNER.handle.toUpperCase()}//MERIDIAN`}>
          {[...`${OWNER.handle.toUpperCase()}//MERIDIAN`].map((ch, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="boot__ch"
              style={{
                animationDelay: `${150 + i * 34}ms`,
                color: ch === "/" ? "var(--oxide)" : undefined,
              }}
            >
              {ch}
            </span>
          ))}
        </h1>

        <p className="boot__line t-lead boot__dev" style={{ ["--dev" as string]: "2" }}>
          Nothing here is self-reported — the instruments read the repositories
          and publish what they find.
        </p>

        <div className="boot__meter boot__dev" style={{ ["--dev" as string]: "3" }}>
          <div className="boot__meterHead">
            <span>{current ? current.label : `Ready · ${catalogued} catalogued`}</span>
            <span style={{ color: "var(--oxide)" }}>{pct}%</span>
          </div>
          <div className="boot__track">
            <div className="boot__fill" style={{ width: `${pct}%` }} />
          </div>

          {/* the steps, so the bar is legible as measurement rather than motion */}
          <ul className="boot__steps">
            {STEPS.map((s) => (
              <li key={s.id} data-done={done.includes(s.id)}>
                {done.includes(s.id) ? "◆" : "◇"} {s.label}
              </li>
            ))}
          </ul>
        </div>

        <p className="boot__skip boot__dev" style={{ ["--dev" as string]: "4" }}>
          Click anywhere or press <strong>Enter</strong> to skip
        </p>
      </div>

      <div className="boot__field" aria-hidden="true">
        <Lattice className="boot__lattice" scale={1} />
      </div>
    </div>
  );
}
