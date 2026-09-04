/**
 * Identity and apparatus — constants with no I/O.
 *
 * These live apart from lib/content.ts because the Reticle is a client
 * component and needs them: anything a browser bundle imports must not drag a
 * filesystem read along behind it.
 */
/** Who this observatory belongs to. The only hard-coded identity on the page. */
export const OWNER = {
  name: "Hem Patel",
  handle: "Hem60",
  github: "https://github.com/Hem60",
  linkedin: "https://www.linkedin.com/in/hem-patel-02b215377/",
  email: "patelhem60@gmail.com",
} as const;

/**
 * The availability line.
 *
 * The one row on the dossier panel that is a claim rather than a reading —
 * nothing in a repository can tell a reader whether its author is looking for
 * work. Taken from the resume's own self-description. Edit it here; it is
 * deliberately the only such row.
 */
export const STATUS = "Machine learning, AI and data science — open to internships and graduate roles";

/** The five instruments. Their call counts are runtime, and phase 05 owns them. */
export const INSTRUMENTS = [
  { id: "sextant", glyph: "SX", name: "Sextant", job: "Measures. Scores a repository on the five axes." },
  { id: "prism", glyph: "PR", name: "Prism", job: "Reads code. Splits a repository into its constituent signals." },
  { id: "almanac", glyph: "AL", name: "Almanac", job: "Retrieves. Pulls history, contributors and rate-limited facts." },
  { id: "herald", glyph: "HE", name: "Herald", job: "Writes entries, from templates bound to measured signals." },
  { id: "plumb", glyph: "PL", name: "Plumb", job: "Verifies Herald. Every clause, against a path that resolves." },
] as const;
