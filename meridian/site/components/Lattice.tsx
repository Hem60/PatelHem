"use client";

/**
 * The lattice field — the animated ground behind the hero and the colophon.
 *
 * This is a reproduction of the 300-frame sequence in the project root
 * (`ezgif-frame-001..300.png`), not a playback of it. The source is a 744x750
 * two-colour loop: a dot lattice where cells bloom into plump X glyphs that
 * fuse with their neighbours. Measured off the frames:
 *
 *   pitch          33.5px
 *   dot diameter   9–10px  (r/pitch = 0.142)
 *   first centre   68.5, 71.5
 *   palette        #dfdfdf ground, #000000 ink — two colours, no mid-tones
 *   coverage       8–9% ink
 *
 * Why redraw it instead of playing the frames: the sequence is 62MB of PNG at
 * one fixed size. Decimated and downscaled enough to ship it would look worse
 * than this does, it would be locked to 744x750, it could not take the plate's
 * colours, and it could not stop for a reader who asked for reduced motion.
 * Redrawn it is a few KB, crisp at any size, and themeable. The frames stay in
 * the repository as the reference this was measured against.
 *
 * ── The fuse ────────────────────────────────────────────────────────────────
 * Neighbouring glyphs weld into one blob rather than overlapping. That is a
 * blur followed by an ALPHA threshold, and the distinction matters: two
 * earlier cuts of this file got it wrong.
 *
 *   1. `ctx.filter` set once and then a thousand shapes drawn — `ctx.filter`
 *      is per draw call, so that is a thousand full-canvas blur passes. It
 *      wedged the renderer.
 *   2. `blur() contrast()` on the composite — `contrast()` pivots on
 *      luminance, not alpha, so a blurred transparent edge stays a soft
 *      gradient. The field came out as mush.
 *
 * The fix is an SVG `feColorMatrix` on the alpha channel, applied to the
 * canvas element in CSS. It thresholds the blur properly, it is declared once,
 * and the compositor does it on the GPU — so the draw loop is plain crisp
 * shapes and costs nothing unusual.
 */
import { useEffect, useId, useRef } from "react";

/** Geometry, in source pixels. Scaled by `scale`. */
const PITCH = 33.5;
const DOT_R = 4.75;

/**
 * Gooey blur radius, as a fraction of the dot.
 *
 * Just over half the dot: wide enough that two blooms meeting at the pitch
 * weld, narrow enough that the resting dots survive the alpha threshold at
 * full strength.
 */
const BLUR_R = 0.55;

/** Bar thickness of an X, as a fraction of its radius. */
const BAR = 0.54;

/** A bloom's lifetime, and how much of the field is blooming at once. */
const BLOOM_MS = 2600;
/*
 * 0.085 was the source's measured ink coverage, but coverage is not the same
 * as selection: a chosen cell only blooms for BLOOM_MS out of a longer period,
 * so under half of them are open at any instant. 0.13 selected lands about
 * 0.085 on screen.
 */
const DENSITY = 0.095;

/**
 * Deterministic hash → [0, 1).
 *
 * Every cell's phase and lifetime comes from its coordinates, not from
 * `Math.random`, so the field is the same field on every load. It is the same
 * discipline the ranks on this page follow.
 */
function hash(x: number, y: number, salt: number): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2246822519) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Ease a bloom in and out — 0 at both ends, 1 at its peak. */
function pulse(t: number): number {
  const s = Math.sin(Math.PI * t);
  return s * s;
}

export function Lattice({
  className,
  scale = 1,
  /** Ink coverage multiplier. The colophon wants a quieter field than the hero. */
  intensity = 1,
}: {
  className?: string;
  scale?: number;
  intensity?: number;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const raw = useId();
  const filterId = `goo${raw.replace(/[^a-zA-Z0-9]/g, "")}`;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pitch = PITCH * scale;
    const dot = DOT_R * scale;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let frame = 0;
    let visible = true;
    let last = 0;

    /*
     * Two colours, read off the element so the field follows the plate: the
     * resting lattice in ink, the blooms in the accent. The source loop is
     * monochrome, but a field that shares the page's one accent colour ties
     * the ground to the headline instead of sitting behind it as grey noise.
     */
    const read = () => {
      const style = getComputedStyle(canvas);
      return {
        ink: style.getPropertyValue("--lattice-ink").trim() || "#000000",
        accent: style.getPropertyValue("--lattice-accent").trim() || "#000000",
      };
    };
    let colours = read();

    /**
     * How many cells fit along an axis.
     *
     * As many as possible, then backed off until the margin outside the outer
     * centres clears a bloom's reach (pitch/2) plus the blur. Holding back a
     * whole pitch unconditionally was safe but wasteful — it cost a row, and
     * the leftover showed as dead bands above and below the field.
     */
    const fit = (extent: number): number => {
      let n = Math.max(1, Math.floor(extent / pitch));
      while (n > 1 && (extent - (n - 1) * pitch) / 2 < pitch * 0.55) n -= 1;
      return n;
    };

    /**
     * One X glyph, drawn as two crossed bars with round caps.
     *
     * The proportions matter more than they look. At arm 0.7r and width 0.82r
     * the bars were nearly as thick as they were long, so the gooey threshold
     * welded them into a rounded square — those were the stray red blocks in
     * the field, and raising the size cutoff only hid the smallest of them.
     * Long arms, thinner bars: it reads as a cross at every size, so the cutoff
     * can go back down and more of the bloom's life is visible.
     */
    const cross = (cx: number, cy: number, r: number) => {
      const a = r * 0.94;
      ctx.lineWidth = r * BAR;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx - a, cy - a);
      ctx.lineTo(cx + a, cy + a);
      ctx.moveTo(cx + a, cy - a);
      ctx.lineTo(cx - a, cy + a);
      ctx.stroke();
    };

    const draw = (now: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      /*
       * Whole cells, centred.
       *
       * Laying the grid out from x = pitch/2 left a partial column at the
       * right-hand edge, so the band ended on half dots sliced by the viewport.
       * Centring the cells fixed the dots but not the blooms: a bloom reaches
       * pitch/2 from its centre and the gooey blur adds more, so an edge cell
       * still got sliced whenever the width divided evenly.
       *
       * `fit` handles it: as many whole cells as possible, backed off until the
       * margin outside the outer centres clears a bloom's reach plus the blur.
       * Nothing can touch an edge now, at any size, and no row is wasted.
       */
      const cols = fit(width);
      const rows = fit(height);
      const originX = (width - (cols - 1) * pitch) / 2;
      const originY = (height - (rows - 1) * pitch) / 2;

      /* the resting lattice, all of it, in one path — one fill for the lot */
      ctx.fillStyle = colours.ink;
      ctx.beginPath();
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          const cx = originX + gx * pitch;
          const cy = originY + gy * pitch;
          ctx.moveTo(cx + dot, cy);
          ctx.arc(cx, cy, dot, 0, Math.PI * 2);
        }
      }
      ctx.fill();

      /* and the blooms over them, in the accent */
      ctx.strokeStyle = colours.accent;
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          if (hash(gx, gy, 1) > DENSITY * intensity) continue;

          const period = BLOOM_MS * (1.4 + hash(gx, gy, 2) * 2.2);
          const offset = hash(gx, gy, 3) * period;
          const t = still ? 0.62 : (((now + offset) % period) / period) * (period / BLOOM_MS);
          if (t > 1) continue;

          /*
           * A cross whose bars are thinner than the blur is wide does not
           * survive the alpha threshold: the arms dissolve and what is left is
           * the dot underneath, fattened into a red blob. That — not the arm
           * proportions — is what the stray squares actually were.
           *
           * So the cutoff is derived from the blur rather than guessed: hold
           * the cell as a dot until its bars clear the blur diameter. Change
           * BLUR_R and this follows it.
           */
          const grow = pulse(t);
          const r = dot + grow * (pitch * 0.5 - dot);
          if (r * BAR < BLUR_R * dot * 2) continue;
          cross(originX + gx * pitch, originY + gy * pitch, r);
        }
      }
    };

    /*
     * 30fps, not 60. The field is slow-moving texture and nobody can tell the
     * difference — but the SVG filter recomposites on every paint, so halving
     * the rate halves the only expensive thing on the page.
     */
    const MIN_MS = 33;

    const tick = (now: number) => {
      frame = window.requestAnimationFrame(tick);
      if (!visible || now - last < MIN_MS) return;
      last = now;
      draw(now);
    };

    const size = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      colours = read();
      draw(performance.now());
    };

    size();
    const ro = new ResizeObserver(size);
    ro.observe(canvas);

    /*
     * Re-read the palette when the exposure changes.
     *
     * The colours were read in `size()` alone, which runs on mount and on
     * resize — so flipping the plate left the field painting in the previous
     * exposure's ink. Night to day was the visible one: cream ink carried over
     * onto the light ground and the whole field all but vanished.
     *
     * Watching the attribute rather than re-reading every frame keeps
     * `getComputedStyle` out of the draw loop, where it would force a style
     * recalculation thirty times a second per field.
     */
    const plate = new MutationObserver(() => {
      colours = read();
      draw(performance.now());
    });
    plate.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-plate"],
    });

    /* A field nobody is looking at should not be costing frames. */
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) visible = entry.isIntersecting;
    });
    io.observe(canvas);

    if (!still) frame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      plate.disconnect();
    };
  }, [scale, intensity]);

  /*
   * Sized to the DOT, not to the pitch.
   *
   * The blur has to be smaller than the smallest thing in the field or that
   * thing disappears: at sigma 6.4 against a 4.75px dot radius the dot's
   * blurred peak alpha never reached the threshold and the resting lattice
   * vanished, leaving four smeared blobs. Just over half the dot radius keeps
   * the dots at full alpha while still being wide enough that two blooms
   * meeting at the pitch weld into one shape.
   */
  const blur = (DOT_R * scale * BLUR_R).toFixed(2);

  return (
    <>
      {/*
        * The alpha threshold. `feColorMatrix` multiplies the blurred alpha up
        * hard and subtracts the tail, which turns a soft gradient back into a
        * hard edge — and two edges that overlap become one shape. This is the
        * whole reason the field reads as one material instead of a grid of
        * sprites.
        */}
      <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
        <defs>
          <filter id={filterId} colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="soft" />
            <feColorMatrix
              in="soft"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8"
              result="hard"
            />
          </filter>
        </defs>
      </svg>

      <canvas
        ref={ref}
        className={className}
        style={{ filter: `url(#${filterId})` }}
        aria-hidden="true"
      />
    </>
  );
}
