/**
 * The shelf: which entries the vault displays.
 *
 * ── Why this is its own file ────────────────────────────────────────────────
 * This lives apart from `lib/catalogue.ts` for the reason recorded in
 * CLAUDE.md as trap 3: `catalogue.ts` reads the filesystem, and the vault is a
 * client component. A value imported from it lands in the browser bundle and
 * Turbopack fails on `node:fs` with a panic rather than a useful error. Types
 * are safe because `import type` is erased; a function is not.
 *
 * So the rule the vault applies lives here, pure and importable from either
 * side, and testable without rendering anything.
 */
import type { Catalogue, Entry } from "./catalogue";

/**
 * How many objects the vault displays.
 *
 * Display only. `catalogue.json` and `/dossier.json` carry every entry; this
 * governs the shelf and nothing else, and the plate says how many fall below
 * it rather than dropping them silently.
 */
export const SHELF = 10;

/**
 * The top `n` entries by composite.
 *
 * The cut is the same arithmetic that produces the class on the band, so
 * nobody chooses the ten: improve a repository and it climbs on the next
 * survey; leave one while others improve and it falls off the shelf.
 *
 * Ties break by name so the order is stable across runs — two repositories on
 * the same composite must not swap places on every publish.
 */
export function shelf(cat: Catalogue, n: number = SHELF): Entry[] {
  return [...cat.entries]
    .sort((a, b) => b.composite - a.composite || a.name.localeCompare(b.name))
    .slice(0, Math.max(0, n));
}
