import type { ScoredRepo, Signals } from "@meridian/engine";
import type { Entry } from "./catalogue.js";
import { compose as heraldCompose, facts, topLanguages } from "./herald.js";
import { verify, type VerificationReport } from "./plumb.js";

/**
 * One repository's prose, and who wrote it.
 *
 * There are two writers and the difference is load-bearing. The author writes
 * a thesis by hand: the argument for why the project exists, which no
 * measurement can produce. A drafting model writes a line for a repository
 * that has no hand-written one yet, from the facts the survey already
 * measured — so a newly discovered repository arrives with words instead of a
 * blank, and is labelled as drafted rather than passed off as authored.
 *
 * `source` is the whole reason this is an object and not a string. A card
 * carrying a machine-written line that reads as the author's would be exactly
 * the forgery this build exists not to be.
 */
export interface ProseEntry {
  readonly thesis: string;
  /** A longer paragraph. Only the drafter writes one; null otherwise. */
  readonly description: string | null;
  readonly source: "author" | "groq";
  /** The model that drafted it. Null when a person wrote it. */
  readonly model: string | null;
  /** ISO timestamp of the draft. Null when a person wrote it. */
  readonly generated: string | null;
  /**
   * A digest of the measured sentences the draft was written from.
   *
   * The drafter rewrites a line only when this stops matching, so a repository
   * whose readings have not moved does not produce a new paragraph and a new
   * commit on every survey.
   */
  readonly factsHash: string | null;
}

/**
 * Thesis lines keyed by repo name.
 *
 * A bare string is accepted and means an authored line — that is the shape the
 * file had before drafting existed, and the author writes by hand into this
 * file, so the short form has to keep working.
 */
export type Prose = Readonly<Record<string, string | ProseEntry>>;

/** Normalise either shape to one. Returns null when there is no entry. */
export function proseOf(prose: Prose, name: string): ProseEntry | null {
  const raw = prose[name];
  if (raw === undefined) return null;
  if (typeof raw === "string")
    return raw.trim() === ""
      ? null
      : { thesis: raw, description: null, source: "author", model: null, generated: null, factsHash: null };
  return raw.thesis.trim() === "" ? null : raw;
}

export interface Composed {
  readonly entry: Entry;
  readonly verification: VerificationReport;
}

/**
 * Stage 04. Herald writes, Plumb checks, and only upheld sentences reach the
 * card. A repo with no thesis line still publishes — marked unannotated
 * rather than held back, so a new project appears without being asked for.
 */
export function composeEntry(
  s: Signals,
  r: ScoredRepo,
  prose: Prose,
  user: string,
  now: string,
): Composed {
  const verification = verify(s, heraldCompose(s, r));
  const written = proseOf(prose, s.name);

  const entry: Entry = {
    name: s.name,
    classification: r.classification,
    composite: r.composite,
    axes: Object.fromEntries(
      Object.entries(r.axes).map(([k, v]) => [k, Math.round(v.value * 10) / 10]),
    ),
    /* the same readings, undivided — see Entry.parts */
    parts: Object.fromEntries(
      Object.entries(r.axes).map(([k, v]) => [
        k,
        Object.fromEntries(
          Object.entries(v.parts).map(([part, n]) => [part, Math.round(n * 10) / 10]),
        ),
      ]),
    ),
    thesis: written?.thesis ?? null,
    description: written?.description ?? null,
    thesisSource: written?.source ?? null,
    /*
     * Still means HAND-WRITTEN, and only that.
     *
     * A drafted line is words on a card; an annotated entry is one the author
     * argued for. The page says "hand-written" in several places and the
     * machine-readable summary counts them, so widening this flag to include
     * drafts would make those statements false. `thesisSource` carries the
     * distinction instead.
     */
    annotated: written?.source === "author",
    summary: verification.upheld.map(c => c.text),
    facts: facts(s, r),
    stack: topLanguages(s, 6),
    authorship: {
      share: r.authorship.share, mine: r.authorship.mine, total: r.authorship.total,
    },
    links: {
      code: "https://github.com/" + user + "/" + s.name,
      live: s.homepageStatus === 200 ? s.homepage : null,
    },
    updated: now,
  };
  return { entry, verification };
}
