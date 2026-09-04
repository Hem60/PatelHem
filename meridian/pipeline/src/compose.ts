import type { ScoredRepo, Signals } from "@meridian/engine";
import type { Entry } from "./catalogue.js";
import { compose as heraldCompose, facts, topLanguages } from "./herald.js";
import { verify, type VerificationReport } from "./plumb.js";

/** Hand-written thesis lines, keyed by repo name. The one thing you supply. */
export type Prose = Readonly<Record<string, string>>;

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
  const thesis = prose[s.name] ?? null;

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
    thesis,
    annotated: thesis !== null,
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
