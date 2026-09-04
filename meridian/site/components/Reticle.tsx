"use client";

/**
 * The HUD.
 *
 * One bar across the top, matched to the reference build: wordmark, section
 * index, the instrument sigil row, level and XP, sound, exposure, and a drawer
 * on small screens.
 *
 * The wordmark borrows his `NAME//THING` construction and nothing else — the
 * identity in it is Hem's. See meridian/FOUNDRY-MATCH.md for what is copied
 * and what is never copied.
 *
 * The sigils are lit by recruitment, dim otherwise. They are not fake
 * telemetry: unlit means that instrument has not been recruited in this
 * session, lit means it has.
 */
import { useEffect, useState } from "react";
import { SIGILS } from "@/lib/sigil";
import { OWNER } from "@/lib/owner";
import { useProgress } from "./Calibration";
import { Sigil } from "./Sigil";

const NAV = [
  { id: "parallax", label: "About" },
  { id: "observing-run", label: "Console" },
  { id: "catalogue", label: "Work" },
  { id: "constellation", label: "Skills" },
  { id: "log", label: "Education" },
  { id: "how-to-read", label: "Assay" },
  { id: "shell", label: "Terminal" },
  { id: "hailing", label: "Contact" },
];

type Exposure = "night" | "day";

/*
 * Sun and moon, as 7x7 bitmaps.
 *
 * The button used to be labelled with the word NIGHT or DAY, which read
 * backwards to half the people who used it — it named the state, not the
 * action, so "NIGHT" looked like a button that would make things dark when the
 * page was already dark.
 *
 * Drawn as cell grids rather than as glyphs or an icon font, for the same
 * reason the instrument sigils are: no download, crisp at any density, and it
 * takes `currentColor` so it follows the plate. A character like U+2600 would
 * have rendered in whatever the fallback font felt like.
 */
const SUN = [
  "0001000",
  "0100010",
  "0011100",
  "1011101",
  "0011100",
  "0100010",
  "0001000",
];

/*
 * The sound control's two glyphs, 7x7.
 *
 * A speaker, not a musical note: the note said "music", but the control means
 * "sound on", and the two arcs versus the cross is the clearest on/off pair
 * that survives a seven-pixel grid.
 *
 * Columns 0-2 are the speaker — a one-cell driver, a cone widening to the
 * right — and columns 4-6 carry the state, with column 3 left empty so the
 * two halves never touch and smear into one blob at 14px.
 *
 * The outer arc steps in at its ends (col 5 on the top and bottom rows, col 6
 * across the middle three). Drawn straight down one column it read as three
 * loose pixels rather than a curve; the one-cell step is the least a 7x7 grid
 * needs to say "arc".
 */
const SOUND_ON = [
  "0010000",
  "0110010",
  "1110101",
  "1110101",
  "1110101",
  "0110010",
  "0010000",
];

const SOUND_OFF = [
  "0010000",
  "0110000",
  "1110101",
  "1110010",
  "1110101",
  "0110000",
  "0010000",
];

const MOON = [
  "0011100",
  "0111000",
  "1110000",
  "1110000",
  "1110000",
  "0111000",
  "0011100",
];

/**
 * One bitmap, at `size` pixels per cell, inked in `currentColor`.
 *
 * `gap` is 0 in the HUD: at 2px cells the 1px gutters add another 6px in each
 * direction, which is part of what made this button 13px taller than the two
 * beside it. Solid cells read better than a gapped grid at icon size anyway.
 */
function Glyph({ rows, size = 2, gap = 1 }: { rows: string[]; size?: number; gap?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${rows[0]?.length ?? 0}, ${size}px)`,
        gap: `${gap}px`,
        lineHeight: 0,
      }}
    >
      {rows.flatMap((row, y) =>
        [...row].map((cell, x) => (
          <span
            key={`${x}-${y}`}
            style={{
              width: `${size}px`,
              height: `${size}px`,
              background: cell === "1" ? "currentColor" : "transparent",
            }}
          />
        )),
      )}
    </span>
  );
}

function useExposure(): [Exposure, () => void] {
  const [exposure, setExposure] = useState<Exposure>("night");

  useEffect(() => {
    const current = document.documentElement.dataset.plate;
    if (current === "day" || current === "night") setExposure(current);
  }, []);

  const toggle = () => {
    setExposure((prev) => {
      const next: Exposure = prev === "night" ? "day" : "night";
      document.documentElement.dataset.plate = next;
      try {
        localStorage.setItem("meridian.plate", next);
      } catch {
        /* a browser refusing storage is not a reason to refuse the toggle */
      }
      return next;
    });
  };

  return [exposure, toggle];
}

export function Reticle({ lastRun, catalogued }: { lastRun: string; catalogued: number }) {
  const { level, xp, intoLevel, perLevel, isRecruited, sound, toggleSound, music } = useProgress();
  const [exposure, toggleExposure] = useExposure();
  const [open, setOpen] = useState(false);
  void lastRun;
  void catalogued;

  const filled = Math.round((intoLevel / perLevel) * 16);

  return (
    <header
      className="fixed inset-x-0 top-0 border-b"
      style={{
        zIndex: "var(--z-hud)",
        borderColor: "var(--rule-strong)",
        backgroundColor: "color-mix(in srgb, var(--paper) 94%, transparent)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        className="flex items-center gap-5"
        style={{ minHeight: "3.25rem", paddingInline: "var(--gutter)" }}
      >
        {/* wordmark — his construction, our identity */}
        <a
          href="#first-light"
          className="t-display"
          style={{
            fontSize: "1.15rem",
            letterSpacing: "0.02em",
            textDecorationLine: "underline",
            textDecorationColor: "var(--oxide)",
            textUnderlineOffset: "0.3em",
            whiteSpace: "nowrap",
          }}
        >
          {OWNER.handle.toUpperCase()}
          <span style={{ color: "var(--oxide)" }}>//</span>MERIDIAN
        </a>

        <nav aria-label="Sections" className="hidden flex-1 items-center gap-5 xl:flex">
          {NAV.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              className="label no-underline"
              style={{ color: "var(--ink-soft)" }}
            >
              {n.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-4 xl:ml-0">
          {/* instrument sigils, lit by recruitment */}
          <ul className="hidden items-center gap-2 lg:flex" aria-label="Instruments">
            {SIGILS.map((s) => (
              <li key={s.id} className="flex items-center">
                <span
                  className="flex items-center justify-center border"
                  style={{
                    borderColor: isRecruited(s.id) ? `var(${s.token})` : "var(--rule)",
                    padding: "3px",
                    lineHeight: 0,
                  }}
                >
                  <Sigil
                    id={s.id}
                    size={2}
                    on={isRecruited(s.id)}
                    title={`${s.name} — ${isRecruited(s.id) ? "recruited" : "not recruited"}`}
                  />
                </span>
              </li>
            ))}
          </ul>

          {/* level and XP */}
          <div className="hidden items-center gap-2 sm:flex" title={`${xp} XP total`}>
            <span className="label" style={{ color: "var(--oxide)" }}>
              LVL {level}
            </span>
            <span
              aria-label={`Experience: ${intoLevel} of ${perLevel} to the next level`}
              role="meter"
              aria-valuenow={intoLevel}
              aria-valuemin={0}
              aria-valuemax={perLevel}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(16, 3px)",
                gap: "1px",
                lineHeight: 0,
              }}
            >
              {Array.from({ length: 16 }, (_, i) => (
                <span
                  key={i}
                  style={{
                    width: "3px",
                    height: "10px",
                    background: i < filled ? "var(--oxide)" : "var(--rule)",
                  }}
                />
              ))}
            </span>
            <span className="t-data" style={{ fontSize: "var(--t-2xs)", color: "var(--ink-faint)" }}>
              {intoLevel}/{perLevel}
            </span>
          </div>

          {/*
            * The ambient track, and the only sound control left. The page made
            * synthesised interface tones once — a click on every control and
            * two progress blips — and they are all gone, so there is nothing
            * else here to switch.
            */}
          <button
            type="button"
            onClick={toggleSound}
            className="hud-btn hud-btn--icon"
            style={{
              borderColor: sound ? "var(--oxide)" : "var(--rule-strong)",
              color: sound ? "var(--oxide)" : "var(--ink-soft)",
            }}
            aria-pressed={sound}
            aria-label={
              !sound
                ? "Ambient track off. Press to play."
                : music === "missing"
                  ? "Ambient track requested but no file is loaded. Press to stop."
                  : "Ambient track playing. Press to stop."
            }
            title={sound ? "Stop the ambient track" : "Play the ambient track"}
          >
            <Glyph rows={sound ? SOUND_ON : SOUND_OFF} size={2} gap={0} />
          </button>

          {/*
            * One control, and it shows what it will DO: a sun while the page is
            * dark, a moon while it is light. The label carries both the current
            * state and the action, since the glyph alone cannot say which is
            * which to a screen reader.
            */}
          <button
            type="button"
            onClick={toggleExposure}
            className="hud-btn hud-btn--icon"
            style={{ borderColor: "var(--rule-strong)", color: "var(--ink-soft)" }}
            aria-pressed={exposure === "day"}
            aria-label={`Exposure is ${exposure}. Switch to ${exposure === "night" ? "day" : "night"}.`}
            title={`Switch to ${exposure === "night" ? "day" : "night"}`}
          >
            <Glyph rows={exposure === "night" ? SUN : MOON} size={2} gap={0} />
          </button>

          <button
            type="button"
            className="hud-btn xl:hidden"
            style={{ borderColor: "var(--rule-strong)" }}
            aria-expanded={open}
            aria-controls="hud-index"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Close" : "Index"}
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="hud-index"
          aria-label="Sections"
          className="border-t xl:hidden"
          style={{ borderColor: "var(--rule)" }}
        >
          {NAV.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              onClick={() => setOpen(false)}
              className="label block border-b px-4 py-3 no-underline"
              style={{ borderColor: "var(--rule)" }}
            >
              {n.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
