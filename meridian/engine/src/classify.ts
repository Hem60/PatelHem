import type { Classification } from "./signals.js";

/**
 * Class thresholds, calibrated in phase 00 against external anchors:
 * ossf/scorecard lands at 78.2, a strong personal flagship around 67.
 * These are deliberately hard. A ladder that cannot say no is decoration.
 */
export const THRESHOLDS = {
  MYTHIC: 88,
  LEGENDARY: 76,
  EPIC: 64,
  RARE: 50,
  UNCOMMON: 34,
} as const satisfies Record<Exclude<Classification, "COMMON">, number>;

/** Highest class first. Order matters for both lookup and display. */
export const ORDER: readonly Classification[] = [
  "MYTHIC", "LEGENDARY", "EPIC", "RARE", "UNCOMMON", "COMMON",
] as const;

export type Thresholds = Readonly<Record<Exclude<Classification, "COMMON">, number>>;

export function classify(composite: number, t: Thresholds = THRESHOLDS): Classification {
  if (composite >= t.MYTHIC) return "MYTHIC";
  if (composite >= t.LEGENDARY) return "LEGENDARY";
  if (composite >= t.EPIC) return "EPIC";
  if (composite >= t.RARE) return "RARE";
  if (composite >= t.UNCOMMON) return "UNCOMMON";
  return "COMMON";
}

/** The next class up, and how far away it is. Null once at the top. */
export function nextGate(
  composite: number,
  t: Thresholds = THRESHOLDS,
): { readonly target: Classification; readonly gap: number } | null {
  const climbing = [...ORDER].reverse().filter((c): c is Exclude<Classification, "COMMON"> => c !== "COMMON");
  for (const c of climbing) {
    if (t[c] > composite) return { target: c, gap: round(t[c] - composite) };
  }
  return null;
}

export const round = (n: number): number => Math.round(n * 10) / 10;

// ---------------------------------------------------------------------------
// Hysteresis
//
// Without it, a repo sitting on 75.6 flips between EPIC and LEGENDARY on
// consecutive runs and the revisions log fills with noise. With it, a
// promotion means something improved and stayed improved.
// ---------------------------------------------------------------------------

export const HYSTERESIS = {
  /** Must clear the threshold by this much to promote. */
  promoteMargin: 2,
  /** ...and hold for this many consecutive runs. */
  promoteRuns: 2,
  /** Must fall below by this much to demote. */
  demoteMargin: 3,
  /** ...and hold for this many consecutive runs. */
  demoteRuns: 3,
  /** A class is never revoked within this many days of being granted. */
  floorDays: 30,
} as const;

export interface ClassState {
  readonly current: Classification;
  /** ISO date the current class was granted. */
  readonly since: string;
  /** Recent composites, oldest first. The newest run appends to this. */
  readonly history: readonly number[];
}

export type Transition =
  | { readonly kind: "hold"; readonly reason: string }
  | { readonly kind: "promote"; readonly to: Classification; readonly from: Classification }
  | { readonly kind: "demote"; readonly to: Classification; readonly from: Classification };

/**
 * Decide whether a class actually moves. Pure: same state and score always
 * give the same transition.
 */
export function transition(
  state: ClassState,
  composite: number,
  now: string,
  t: Thresholds = THRESHOLDS,
  h: typeof HYSTERESIS = HYSTERESIS,
): Transition {
  const raw = classify(composite, t);
  if (raw === state.current) return { kind: "hold", reason: "unchanged" };

  const runs = [...state.history, composite];
  const rank = (c: Classification): number => ORDER.indexOf(c);
  const promoting = rank(raw) < rank(state.current);

  if (promoting) {
    const threshold = t[raw as Exclude<Classification, "COMMON">];
    const recent = runs.slice(-h.promoteRuns);
    const cleared = recent.length >= h.promoteRuns
      && recent.every(v => v >= threshold + h.promoteMargin);
    return cleared
      ? { kind: "promote", to: raw, from: state.current }
      : { kind: "hold", reason: `needs ${h.promoteRuns} runs at or above ${threshold + h.promoteMargin}` };
  }

  const ageDays = (Date.parse(now) - Date.parse(state.since)) / 86_400_000;
  if (ageDays < h.floorDays) {
    return { kind: "hold", reason: `class floor — granted ${Math.floor(ageDays)}d ago, held for ${h.floorDays}d` };
  }
  const held = state.current === "COMMON" ? -Infinity : t[state.current as Exclude<Classification, "COMMON">];
  const recent = runs.slice(-h.demoteRuns);
  const fallen = recent.length >= h.demoteRuns
    && recent.every(v => v <= held - h.demoteMargin);
  return fallen
    ? { kind: "demote", to: raw, from: state.current }
    : { kind: "hold", reason: `needs ${h.demoteRuns} runs at or below ${held - h.demoteMargin}` };
}
