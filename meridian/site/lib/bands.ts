/**
 * The class ramp.
 *
 * Six bands, fixed thresholds, and one CSS variable per class. Colour on this
 * page always means something: these six values encode rank and are used
 * nowhere else, and the signal amber that marks live state is not one of them.
 *
 * The thresholds here must match the engine's. band() is the only place the
 * site decides what a composite is called, and test/bands.test.ts checks it
 * against every entry the pipeline has actually published.
 */
/**
 * The six classes live here rather than beside the file loader, because the
 * browser bundle needs them and the loader reads the filesystem. Anything a
 * client component imports must be free of I/O.
 */
export const CLASSES = ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "MYTHIC"] as const;
export type Classification = (typeof CLASSES)[number];

export interface Band {
  readonly name: Classification;
  readonly floor: number;
  readonly ceiling: number | null;
  /** The CSS custom property carrying this class's colour, on both plates. */
  readonly token: string;
  /** How the range reads in the legend. */
  readonly range: string;
}

export const BANDS: readonly Band[] = [
  { name: "COMMON", floor: -Infinity, ceiling: 34, token: "--c-common", range: "< 34" },
  { name: "UNCOMMON", floor: 34, ceiling: 50, token: "--c-uncommon", range: "34 – 49" },
  { name: "RARE", floor: 50, ceiling: 64, token: "--c-rare", range: "50 – 63" },
  { name: "EPIC", floor: 64, ceiling: 76, token: "--c-epic", range: "64 – 75" },
  { name: "LEGENDARY", floor: 76, ceiling: 88, token: "--c-legendary", range: "76 – 87" },
  { name: "MYTHIC", floor: 88, ceiling: null, token: "--c-mythic", range: "88 +" },
];

export function band(composite: number): Band {
  /* walk down, so the first band whose floor is cleared wins */
  for (let i = BANDS.length - 1; i >= 0; i--) {
    const b = BANDS[i]!;
    if (composite >= b.floor) return b;
  }
  return BANDS[0]!;
}

export function bandOf(name: Classification): Band {
  const found = BANDS.find((b) => b.name === name);
  if (!found) throw new Error(`no band named ${name}`);
  return found;
}

/** `var(--c-epic)` — for inline style on anything tinted by rank. */
export function classVar(name: Classification): string {
  return `var(${bandOf(name).token})`;
}

/** The five axes and their fixed weights. Stated on the page, not hidden. */
export const AXES = [
  { key: "stability", weight: 0.28, gloss: "Does it hold up — tests, types, lint, CI, containers." },
  { key: "mass", weight: 0.24, gloss: "How much of it there is — code, docs, history." },
  { key: "anomaly", weight: 0.2, gloss: "How unusual the problem is against everything else in the account." },
  { key: "luminosity", weight: 0.16, gloss: "Whether anyone else can see it — stars, forks, a live deployment." },
  { key: "cadence", weight: 0.12, gloss: "Whether work is still arriving, and at what rhythm." },
] as const;

export type AxisKey = (typeof AXES)[number]["key"];

/** The class a repository would have to reach next, if there is one above it. */
export function nextClass(c: Classification): Classification | null {
  const i = CLASSES.indexOf(c);
  return i === CLASSES.length - 1 ? null : (CLASSES[i + 1] as Classification);
}
