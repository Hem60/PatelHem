/**
 * The scoring context a live run uses, and the one honest caveat in it.
 *
 * The anomaly axis measures a repository against the rest of the account, so
 * it needs the account's language distribution — not just the surveyed
 * repository's. The pipeline builds that from the full language map of every
 * repository it collected. A live run cannot: recollecting five repositories
 * to score one would spend the whole anonymous rate limit on arithmetic.
 *
 * So the run approximates it from the published catalogue's stack lists, which
 * carry the top languages per entry rather than every byte count. The
 * approximation is close but not identical, and it can move anomaly by a few
 * points. The panel says so rather than blaming the drift on the repository.
 */
import type { Catalogue } from "../catalogue";

export interface RunContext {
  readonly languageCounts: Record<string, number>;
  /** True when the counts came from stack lists rather than full language maps. */
  readonly approximated: boolean;
  readonly basis: string;
}

export function runContext(cat: Catalogue): RunContext {
  const counts: Record<string, number> = {};
  for (const entry of cat.entries) {
    for (const lang of entry.stack) counts[lang] = (counts[lang] ?? 0) + 1;
  }
  return {
    languageCounts: counts,
    approximated: true,
    basis: `${cat.entries.length} catalogued entries · stack lists from the last observing run`,
  };
}
