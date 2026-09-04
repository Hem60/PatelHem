import { anomaly, cadence, luminosity, mass, stability } from "./axes.js";
import { classify, round, THRESHOLDS, type Thresholds } from "./classify.js";
import type { AxisName, Axis, Authorship, ScoreContext, ScoredRepo, Signals } from "./signals.js";

/**
 * Axis weights. Stability outranks mass on purpose: a small, well-tested
 * project should beat a large untested one. They sum to 1.
 */
export const WEIGHTS = {
  stability: 0.28,
  mass: 0.24,
  anomaly: 0.20,
  luminosity: 0.16,
  cadence: 0.12,
} as const satisfies Record<AxisName, number>;

export function authorshipOf(s: Signals, user: string): Authorship {
  const total = s.contributors.reduce((a, c) => a + c.contributions, 0);
  const mine = s.contributors.find(c => c.login.toLowerCase() === user.toLowerCase());
  return {
    mine: mine?.contributions ?? 0,
    total,
    share: total === 0 ? null : Math.round(((mine?.contributions ?? 0) / total) * 100),
  };
}

/**
 * The whole engine. Pure: identical signals and context always produce an
 * identical result, which is what lets anyone clone the repo and reproduce
 * every rank on the site.
 */
export function score(
  signals: Signals,
  ctx: ScoreContext,
  thresholds: Thresholds = THRESHOLDS,
): ScoredRepo {
  const axes: Record<AxisName, Axis> = {
    stability: stability(signals),
    mass: mass(signals, ctx),
    anomaly: anomaly(signals, ctx),
    luminosity: luminosity(signals),
    cadence: cadence(signals, ctx),
  };

  const composite = round(
    (Object.keys(WEIGHTS) as AxisName[])
      .reduce((total, axis) => total + axes[axis].value * WEIGHTS[axis], 0),
  );

  return {
    name: signals.name,
    fork: signals.fork,
    axes,
    composite,
    classification: classify(composite, thresholds),
    authorship: authorshipOf(signals, ctx.user),
  };
}

/**
 * The catalogue is original work only: forks carry someone else's history
 * and a profile repo is infrastructure, not a project.
 */
export function isCatalogueEntry(s: Signals, user: string): boolean {
  return !s.fork && s.name.toLowerCase() !== user.toLowerCase();
}

/** Language counts across a catalogue, for the distinctness signal. */
export function languageCounts(all: readonly Signals[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const s of all) {
    const primary = Object.keys(s.languages)[0];
    if (primary) counts[primary] = (counts[primary] ?? 0) + 1;
  }
  return counts;
}
