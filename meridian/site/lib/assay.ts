/**
 * The assay: why a repository holds the class it holds.
 *
 * Pure, no I/O. Takes a published entry and decomposes its composite back into
 * the five axis contributions that produced it, attaching to each the evidence
 * lines the survey actually wrote for that axis.
 *
 * The point is that the arithmetic closes. A reader can add the five
 * contributions and get the composite, look up the composite in the band
 * table, and arrive at the class on the card — without taking any step on
 * trust. An axis with no evidence behind it says so rather than borrowing a
 * sentence from a neighbouring axis to look complete.
 */
import { AXES, BANDS, bandOf, nextClass, type AxisKey } from "./bands";
import type { Entry } from "./catalogue";

/**
 * Which axis a survey sentence belongs to.
 *
 * Keyed to the shapes Herald actually emits. Order matters: the first pattern
 * that matches wins, so the specific ones come before the general. If Herald's
 * wording changes, a sentence falls through to no axis and shows up as
 * unattributed on the page — visible, rather than silently miscounted.
 */
const EVIDENCE: { axis: AxisKey; pattern: RegExp }[] = [
  { axis: "stability", pattern: /test files?|test suite/i },
  { axis: "stability", pattern: /continuous integration/i },
  { axis: "stability", pattern: /type checking/i },
  { axis: "stability", pattern: /linting/i },
  { axis: "stability", pattern: /containerised/i },
  { axis: "stability", pattern: /evaluation harness/i },
  { axis: "mass", pattern: /documents under/i },
  { axis: "mass", pattern: /\bKB\b|checked in/i },
  { axis: "anomaly", pattern: /written in/i },
  { axis: "luminosity", pattern: /star|fork|deployment|release|published/i },
  { axis: "cadence", pattern: /commits?\b/i },
];

/** One named component of an axis: what it is worth, and whether it was earned. */
export interface Part {
  readonly key: string;
  /** Points this component contributed. Can be negative on `anomaly`. */
  readonly points: number;
  /** The most it could contribute. Read from the account, not hard-coded. */
  readonly max: number;
  readonly earned: boolean;
}

export interface AxisReading {
  readonly key: AxisKey;
  readonly gloss: string;
  /** The 0-100 reading. */
  readonly value: number;
  readonly weight: number;
  /** value x weight — what this axis put into the composite. */
  readonly contribution: number;
  /** The most this axis could have contributed, at a perfect 100. */
  readonly ceiling: number;
  /** Survey sentences attributed to this axis. */
  readonly evidence: readonly string[];
  /**
   * The components the reading was summed from, best first.
   *
   * Empty for a catalogue published before the pipeline emitted them, in which
   * case the page shows the evidence sentences instead.
   */
  readonly parts: readonly Part[];
}

export interface Assay {
  readonly axes: readonly AxisReading[];
  /** Sum of the contributions. Equals the published composite. */
  readonly total: number;
  readonly published: number;
  readonly classification: string;
  /** The band the composite lands in, and the floor it cleared. */
  readonly floor: number;
  /** What it would take to reach the next class, if there is one. */
  readonly next: { readonly target: string; readonly points: number } | null;
  /** The axis with the most unclaimed points — where the gap is cheapest. */
  readonly weakest: AxisReading | null;
  /** Sentences no axis claimed. Empty unless Herald's wording drifts. */
  readonly unattributed: readonly string[];
}

export function assay(
  entry: Entry,
  /**
   * The engine's component maxima, published in the catalogue.
   *
   * An earlier cut derived these from the account — the highest value any
   * entry had recorded for a component. It was wrong in the way that mattered:
   * a component NO repository has earned came out as 0 of 0, so "Licence" and
   * "Live deployment" read as worthless rather than as eight and thirty points
   * left on the table. The unearned half of the list is the half that says
   * what would move a rank, so it has to carry real ceilings.
   */
  partMax: Record<string, Record<string, number>> = {},
): Assay {
  const claimed = new Set<string>();

  const axes: AxisReading[] = AXES.map((a) => {
    const value = entry.axes[a.key] ?? 0;
    const evidence = entry.summary.filter((line) => {
      const hit = EVIDENCE.find((e) => e.pattern.test(line));
      if (!hit || hit.axis !== a.key) return false;
      claimed.add(line);
      return true;
    });

    const raw = entry.parts?.[a.key] ?? {};
    const parts: Part[] = Object.entries(raw)
      .map(([key, points]) => ({
        key,
        points,
        max: partMax[a.key]?.[key] ?? Math.abs(points),
        earned: points > 0,
      }))
      /* earned first, then by what is at stake — penalties last */
      .sort(
        (x, y) =>
          Number(y.earned) - Number(x.earned) ||
          Math.max(0, y.max) - Math.max(0, x.max) ||
          x.key.localeCompare(y.key),
      );

    return {
      key: a.key,
      gloss: a.gloss,
      value,
      weight: a.weight,
      contribution: value * a.weight,
      ceiling: 100 * a.weight,
      evidence,
      parts,
    };
  });

  const total = axes.reduce((sum, a) => sum + a.contribution, 0);
  const above = nextClass(entry.classification);

  /*
   * Cheapest gap, not lowest reading. An axis at 20 with a 0.12 weight has
   * less headroom than one at 50 with a 0.28 weight, so ranking by the raw
   * value would point a reader at the wrong thing to fix.
   */
  const weakest =
    axes.length === 0
      ? null
      : axes.reduce((worst, a) =>
          a.ceiling - a.contribution > worst.ceiling - worst.contribution ? a : worst,
        );

  return {
    axes,
    total,
    published: entry.composite,
    classification: entry.classification,
    floor: bandOf(entry.classification).floor,
    next: above ? { target: above, points: bandOf(above).floor - entry.composite } : null,
    weakest,
    unattributed: entry.summary.filter((line) => !claimed.has(line)),
  };
}

/** The band table, for the row that shows where a composite lands. */
export const LADDER = BANDS;
