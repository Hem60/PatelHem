/**
 * What a run costs, stated before it runs.
 *
 * These constants live apart from the run itself because the console renders
 * them in the browser, and everything a client component imports has to be
 * free of I/O — `lib/run/instruments.ts` reaches for the filesystem and the
 * network, so importing a value from it would drag both into the bundle.
 */

/** Instrument ids, in dispatch order. The panel draws one lane per entry. */
export const INSTRUMENT_IDS = ["almanac", "prism", "sextant", "herald", "plumb"] as const;

/**
 * One metadata read, one head read, seven history-and-source reads, and one
 * read per manifest found. Manifests are unknown until the tree arrives, so
 * the estimate assumes two and the footer prints what was actually spent.
 */
export const ESTIMATED_CALLS = 1 + 1 + 7 + 1;
