/**
 * Instrument sigils, and which instrument owns which repository.
 *
 * Each instrument gets a 5×5 bitmap drawn as a grid of coloured cells — the
 * reference build's device, and the right one: at this size a pixel glyph
 * reads as an instrument marking rather than an icon set nobody drew.
 *
 * The assignment is computed, not chosen. A repository is filed under the
 * instrument whose axis it scores highest on, so the tag on a card is another
 * measurement rather than a label somebody liked the sound of.
 */
import type { Entry } from "./catalogue";
import { AXES } from "./bands";

export interface Sigil {
  readonly id: string;
  readonly name: string;
  readonly token: string;
  /** 25 characters, row-major. "1" is ink, "0" is ground. */
  readonly bits: string;
  /** The axis this instrument reads, and therefore what it files. */
  readonly axis: string;
  readonly discipline: string;
  /** One line, written by the author, about what the instrument is for. */
  readonly line: string;
  /**
   * What it actually calls. These are the real paths and functions used by
   * the observing run — not a decorative tool list. If a name here stops
   * appearing in lib/run/instruments.ts, the roster is lying.
   */
  readonly tools: readonly string[];
  /** True when the instrument does network work rather than arithmetic. */
  readonly network: boolean;
}

export const SIGILS: readonly Sigil[] = [
  {
    id: "plumb",
    name: "Plumb",
    token: "--agent-plumb",
    axis: "stability",
    discipline: "Verification & proof",
    line: "A sentence nobody can check is a sentence nobody should publish.",
    tools: ["verify(claims)", "paths.resolve", "signal.present"],
    network: false,
    bits: "11111" + "00100" + "00100" + "01110" + "00100",
  },
  {
    id: "almanac",
    name: "Almanac",
    token: "--agent-almanac",
    axis: "mass",
    discipline: "History & retrieval",
    line: "How much of it there is, and how long it took to get there.",
    tools: ["repos.get", "commits.list", "contributors.list", "releases.list", "actions.runs"],
    network: true,
    bits: "11111" + "10001" + "11111" + "10001" + "11111",
  },
  {
    id: "prism",
    name: "Prism",
    token: "--agent-prism",
    axis: "anomaly",
    discipline: "Code reading & signals",
    line: "Configuration lives inside the manifest, so read the manifest.",
    tools: ["git.trees", "languages", "readme", "contents"],
    network: true,
    bits: "00100" + "00100" + "01010" + "01010" + "11111",
  },
  {
    id: "herald",
    name: "Herald",
    token: "--agent-herald",
    axis: "luminosity",
    discipline: "Entries & publication",
    line: "A template fires only when its evidence is already present.",
    tools: ["compose(signals)", "templates", "facts"],
    network: false,
    bits: "11100" + "10010" + "11100" + "10000" + "10000",
  },
  {
    id: "sextant",
    name: "Sextant",
    token: "--agent-sextant",
    axis: "cadence",
    discipline: "Measurement & scoring",
    line: "No network and no clock, or the number cannot be reproduced.",
    tools: ["score(signals, ctx)", "classify", "authorship"],
    network: false,
    bits: "01110" + "10001" + "10101" + "10001" + "01110",
  },
];

/** Which entries an instrument owns: those whose strongest axis it reads. */
export function ownedBy(entries: readonly Entry[], id: string): Entry[] {
  return entries.filter((e) => instrumentFor(e).id === id);
}

/** The account mean for the axis an instrument reads. */
export function axisMean(entries: readonly Entry[], axis: string): number | null {
  const values = entries.map((e) => e.axes[axis]).filter((v): v is number => typeof v === "number");
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

export function sigilOf(id: string): Sigil {
  const found = SIGILS.find((s) => s.id === id);
  if (!found) throw new Error(`no sigil for ${id}`);
  return found;
}

/** The instrument a repository files under: its strongest axis, measured. */
export function instrumentFor(entry: Entry): Sigil {
  let best = SIGILS[0]!;
  let bestValue = -Infinity;
  for (const sigil of SIGILS) {
    const value = entry.axes[sigil.axis] ?? -Infinity;
    /* ties break by the axis order the engine weights them in, so the result
       is stable rather than dependent on object key order */
    if (value > bestValue) {
      best = sigil;
      bestValue = value;
    }
  }
  return best;
}

/** A short computed category line for a card: language, then what it proves. */
export function categoryOf(entry: Entry): string {
  const language = entry.stack[0] ?? "Unclassified";
  const practice = entry.summary.some((s) => s.startsWith("Continuous integration"))
    ? "verified in CI"
    : entry.summary.some((s) => /test files? under/.test(s))
      ? "tested"
      : entry.summary.some((s) => s.startsWith("Containerised"))
        ? "containerised"
        : "unproven";
  return `${language} · ${practice}`;
}

/** Weight order, so a card can name the axis that earned it its instrument. */
export const AXIS_ORDER = AXES.map((a) => a.key);
