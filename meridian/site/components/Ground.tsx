/**
 * The ground: the margin rails.
 *
 * No raster. The field is flat — `--paper`, painted on the body — and
 * everything drawn over it is CSS. Fixed, inert and pointer-transparent; the
 * page scrolls over it.
 *
 * The graticule used to live here, fixed across the viewport, which put grid
 * paper under all twelve plates. It belongs to the hero and is drawn there
 * now: see `Graticule` below and `FirstLight`.
 */
import { plateMark } from "@/lib/format";

/* the major graticule steps every 11rem — the ticks are labelled in the same
   right-ascension hours the survey plate is drawn in, so the two agree */
const H_TICKS = [0, 1, 2, 3, 4, 5, 6, 7];
const V_TICKS = [0, 1, 2, 3, 4, 5];

/**
 * The grid paper, scoped to whatever it is placed inside.
 *
 * Absolute, so its container needs `position: relative`. Only the hero uses
 * it — that is the whole point of it no longer being fixed.
 */
export function Graticule() {
  return (
    <>
      <div className="graticule" aria-hidden="true" />

      <div className="graticule-ticks hidden md:block" aria-hidden="true">
        {H_TICKS.map((i) => (
          <span key={`h${i}`} style={{ top: "3.9rem", left: `calc(${i} * 11rem + 0.25rem)` }}>
            {String(i * 2).padStart(2, "0")}h
          </span>
        ))}
        {V_TICKS.map((i) => (
          <span key={`v${i}`} style={{ left: "0.35rem", top: `calc(${i} * 11rem + 4.2rem)` }}>
            {`+${90 - i * 15}°`}
          </span>
        ))}
      </div>
    </>
  );
}

export function Ground({ lastRun, cat }: { lastRun: string; cat: number }) {
  return (
    <>
      {/* 08 · margin rails, one per gutter */}
      <div
        className="fixed bottom-0 left-0 top-0 z-[2] hidden flex-col items-center justify-end gap-4 pb-6 md:flex"
        style={{ width: "var(--rail)" }}
        aria-hidden="true"
      >
        <span className="rail-ticks" />
        <span className="rail">North polar survey · epoch 2026.0</span>
      </div>
      <div
        className="fixed bottom-0 right-0 top-0 z-[2] hidden flex-col items-center justify-end gap-4 pb-6 md:flex"
        style={{ width: "var(--rail)" }}
        aria-hidden="true"
      >
        <span className="rail-ticks" />
        <span className="rail">Field {plateMark(lastRun)} · {cat} objects catalogued</span>
      </div>
    </>
  );
}
