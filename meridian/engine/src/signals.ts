/**
 * The contract between collection and scoring.
 *
 * Everything the engine needs to classify a repository, and nothing it does
 * not. Collection is I/O and lives elsewhere; scoring is a pure function of
 * this object. That split is what makes the engine testable without a
 * network, and reproducible for anyone who clones the repo.
 */
export interface Signals {
  readonly name: string;
  readonly description: string | null;
  /** A fork is someone else's history. Excluded from the catalogue. */
  readonly fork: boolean;
  readonly archived: boolean;
  readonly private: boolean;

  /** Every path in the default branch, recursive. */
  readonly paths: readonly string[];
  /** Raw contents of manifests, keyed by filename. Config lives inside these. */
  readonly manifests: Readonly<Record<string, string>>;

  readonly languages: Readonly<Record<string, number>>;
  readonly commitCount: number;
  readonly commitDates: readonly string[];
  readonly contributors: readonly { readonly login: string; readonly contributions: number }[];

  readonly createdAt: string;
  readonly pushedAt: string;

  readonly topics: readonly string[];
  readonly license: string | null;
  readonly homepage: string | null;
  /** HTTP status of `homepage`, or null if unset/unreachable. */
  readonly homepageStatus: number | null;
  readonly releaseCount: number;
  readonly stars: number;
  readonly forks: number;
  readonly openIssues: number;

  readonly readmeLength: number;
  readonly readmeImages: number;

  /** Conclusion of the most recent Actions run, if any. */
  readonly lastRunConclusion: string | null;
}

/** Context shared across a whole catalogue. */
export interface ScoreContext {
  /** Whose authorship share to compute. */
  readonly user: string;
  /** Language -> how many repos in the catalogue use it. Feeds distinctness. */
  readonly languageCounts: Readonly<Record<string, number>>;
  /** Evaluation instant. Passed in so scoring is reproducible. */
  readonly now: string;
}

export type AxisName = "stability" | "mass" | "anomaly" | "luminosity" | "cadence";

/** One axis: its value, what each signal contributed, and the raw evidence. */
export interface Axis {
  readonly value: number;
  readonly parts: Readonly<Record<string, number>>;
  readonly evidence: Readonly<Record<string, unknown>>;
}

export type Classification =
  | "MYTHIC" | "LEGENDARY" | "EPIC" | "RARE" | "UNCOMMON" | "COMMON";

export interface Authorship {
  readonly mine: number;
  readonly total: number;
  /** Percentage 0-100, or null when GitHub reports no contributors. */
  readonly share: number | null;
}

export interface ScoredRepo {
  readonly name: string;
  readonly fork: boolean;
  readonly axes: Readonly<Record<AxisName, Axis>>;
  readonly composite: number;
  readonly classification: Classification;
  readonly authorship: Authorship;
}

/** Fills in a Signals object for tests. Every field has a neutral default. */
export function emptySignals(over: Partial<Signals> = {}): Signals {
  return {
    name: "unnamed", description: null, fork: false, archived: false, private: false,
    paths: [], manifests: {}, languages: {}, commitCount: 0, commitDates: [],
    contributors: [], createdAt: "2026-01-01T00:00:00Z", pushedAt: "2026-01-01T00:00:00Z",
    topics: [], license: null, homepage: null, homepageStatus: null, releaseCount: 0,
    stars: 0, forks: 0, openIssues: 0, readmeLength: 0, readmeImages: 0,
    lastRunConclusion: null,
    ...over,
  };
}
