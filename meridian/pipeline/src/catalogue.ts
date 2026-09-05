import type { AxisName, Classification, ScoredRepo } from "@meridian/engine";

/** One verified sentence, and the files that make it true. */
export interface Claim {
  /** Which template produced it. Stable id, used in tests and diffs. */
  readonly template: string;
  readonly text: string;
  /** Paths or evidence keys that must resolve for the claim to stand. */
  readonly cites: readonly string[];
}

export interface VerifiedClaim extends Claim {
  readonly upheld: boolean;
  /** Why Plumb rejected it, when it did. */
  readonly rejection?: string;
}

/** A published card. Every field here is either measured or hand-written. */
export interface Entry {
  readonly name: string;
  readonly classification: Classification;
  readonly composite: number;
  readonly axes: Readonly<Record<string, number>>;
  /**
   * The named components each axis reading was summed from.
   *
   * The engine has always computed these — `stability` is tests + ci + ciGreen
   * + coverage + lint + typing + license + pinned — and the catalogue used to
   * throw them away, keeping only the total. That made the published rank an
   * assertion: a reader could see 89.3 and had no way to find out which of the
   * eight components earned it.
   *
   * Publishing them costs a few hundred bytes and turns the assay from a
   * number into a receipt.
   */
  readonly parts: Readonly<Record<string, Readonly<Record<string, number>>>>;
  /** The thesis line shown on the card, whoever wrote it. Null until one exists. */
  readonly thesis: string | null;
  /** A longer paragraph, written only by the drafter. Null otherwise. */
  readonly description: string | null;
  /** Who wrote the thesis. Null when there is none. */
  readonly thesisSource: "author" | "groq" | null;
  /**
   * True only for a HAND-WRITTEN thesis.
   *
   * Deliberately not widened to cover drafted lines: several statements on the
   * page and in the machine-readable summary count hand-written entries, and a
   * drafted paragraph is not one. An unannotated card still publishes.
   */
  readonly annotated: boolean;
  /** Herald's sentences, after Plumb. */
  readonly summary: readonly string[];
  readonly facts: readonly { readonly label: string; readonly value: string }[];
  readonly stack: readonly string[];
  readonly authorship: { readonly share: number | null; readonly mine: number; readonly total: number };
  readonly links: { readonly code: string; readonly live: string | null };
  /** ISO date this entry was last written by the pipeline. */
  readonly updated: string;
}

export interface Catalogue {
  readonly user: string;
  readonly generated: string;
  /**
   * What each axis component is worth at its best, straight from the engine.
   *
   * Published with the readings so the file explains itself: a consumer can
   * render "8 of 8" without importing the engine or hard-coding a second copy
   * of numbers that only the engine should own.
   */
  readonly partMax?: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly entries: readonly Entry[];
  /** Per-repo class state, so hysteresis survives between runs. */
  readonly state: Readonly<Record<string, StateEntry>>;
}

export interface StateEntry {
  readonly current: Classification;
  /** ISO date the current class was granted. */
  readonly since: string;
  /** Recent composites, oldest first. */
  readonly history: readonly number[];
  /**
   * Axis values as they stood when the current class was granted.
   *
   * A promotion must be explained against the state it is promoting *from*,
   * not against the previous run. Hysteresis means the improvement usually
   * lands one run before the class moves, so comparing to the last run shows
   * no movement at all.
   */
  readonly axesAtGrant: Readonly<Record<string, number>>;
  /** Composite as it stood when the current class was granted. */
  readonly compositeAtGrant: number;
}

/** One line in the public promotion log. The feature to push hardest. */
export interface Revision {
  readonly date: string;
  readonly repo: string;
  readonly from: Classification;
  readonly to: Classification;
  readonly compositeFrom: number;
  readonly compositeTo: number;
  /** The axis that moved most, and the evidence that moved it. */
  readonly cause: {
    readonly axis: string;
    readonly from: number;
    readonly to: number;
    readonly evidence: readonly string[];
  };
  /** Rendered for display: "VAKIL · EPIC → LEGENDARY · stability 61 → 88". */
  readonly headline: string;
}

export interface RevisionLog {
  readonly revisions: readonly Revision[];
}

export const emptyCatalogue = (user: string, now: string): Catalogue => ({
  user, generated: now, entries: [], state: {},
});

/** Which axis moved most between two scorings, with its evidence. */
export function dominantAxis(
  /** Previous axis values from the published entry, or null for a first sighting. */
  before: Readonly<Record<string, number>> | null,
  after: ScoredRepo,
): Revision["cause"] {
  const names = Object.keys(after.axes) as AxisName[];
  let best: AxisName = names[0] ?? "stability";
  let delta = -Infinity;
  for (const n of names) {
    // With no previous entry every axis is compared against zero, which
    // makes this "largest axis". With one, it is genuinely "moved most".
    const b = before?.[n] ?? 0;
    const d = Math.abs(after.axes[n].value - b);
    if (d > delta) { delta = d; best = n; }
  }
  const axis = after.axes[best];
  const evidence = Object.entries(axis.evidence)
    .filter(([, v]) => v === true || (typeof v === "number" && v > 0))
    .map(([k, v]) => (v === true ? k : k + "=" + String(v)));
  return {
    axis: best,
    from: Math.round((before?.[best] ?? 0) * 10) / 10,
    to: Math.round(axis.value * 10) / 10,
    evidence,
  };
}
