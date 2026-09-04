/**
 * The machine's own view of the person.
 *
 * Parallax shows the same subject from three positions. Two of them are
 * written by a human and live in content/parallax.json. This one is not
 * written at all — it is computed from the catalogue every time the page
 * builds, using hard-coded templates that fire only when their evidence is
 * present. No language model is involved, here or anywhere else.
 *
 * Every line carries the measurements that produced it, so the page can print
 * the evidence beside the claim rather than asking to be believed.
 */
import type { Catalogue, Entry } from "./catalogue";
import { AXES } from "./bands";

export interface MachineLine {
  /** Stable template id — the same discipline the pipeline's Herald uses. */
  readonly template: string;
  readonly text: string;
  /** The measurements this sentence rests on. Printed, not footnoted. */
  readonly evidence: readonly string[];
}

const list = (items: string[]): string =>
  items.length <= 1
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

const round = (n: number): string => (Math.round(n * 10) / 10).toFixed(1);

/** "1 repository", "5 repositories". A count that reads wrong reads as sloppy. */
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** Mean of one axis across every entry that reports it. */
function axisMean(entries: readonly Entry[], key: string): number | null {
  const values = entries.map((e) => e.axes[key]).filter((v): v is number => typeof v === "number");
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function factOf(entry: Entry, label: string): string | undefined {
  return entry.facts.find((f) => f.label.toLowerCase() === label.toLowerCase())?.value;
}

export function machineView(cat: Catalogue): MachineLine[] {
  const entries = cat.entries;
  const lines: MachineLine[] = [];
  if (entries.length === 0) return lines;

  const ranked = [...entries].sort((a, b) => b.composite - a.composite);
  const top = ranked[0]!;
  const bottom = ranked[ranked.length - 1]!;

  lines.push({
    template: "scope",
    text:
      `${plural(entries.length, "repository is", "repositories are")} catalogued under ${cat.user}, scoring from ` +
      `${round(bottom.composite)} to ${round(top.composite)} on a five-axis composite.`,
    evidence: [`catalogue.json · entries[] · length ${entries.length}`],
  });

  lines.push({
    template: "strongest",
    text:
      `The strongest reading is ${top.name}, classed ${top.classification} at ` +
      `${round(top.composite)}. Nothing on this page decided that; the engine did, and ` +
      `it will decide differently the moment the repository changes.`,
    evidence: [`${top.name} · composite ${round(top.composite)} · ${top.classification}`],
  });

  /* which axis this account is actually strong on, and which it is not */
  const means: { key: string; mean: number }[] = [];
  for (const a of AXES) {
    const mean = axisMean(entries, a.key);
    if (mean !== null) means.push({ key: a.key, mean });
  }
  if (means.length >= 2) {
    const sorted = [...means].sort((a, b) => b.mean - a.mean);
    const best = sorted[0]!;
    const worst = sorted[sorted.length - 1]!;
    lines.push({
      template: "axis-profile",
      text:
        `Across the account the strongest axis is ${best.key} at a mean of ${round(best.mean)}, ` +
        `and the weakest is ${worst.key} at ${round(worst.mean)}. That is the honest shape of ` +
        `the work: ${worst.key} is where the next class change has to come from.`,
      evidence: means.map((m) => `mean ${m.key} = ${round(m.mean)} across ${entries.length} entries`),
    });
  }

  /* languages, weighted by how many repositories declare them */
  const langs = new Map<string, number>();
  for (const e of entries) for (const s of e.stack) langs.set(s, (langs.get(s) ?? 0) + 1);
  if (langs.size > 0) {
    const ordered = [...langs.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const primary = ordered[0]!;
    const rest = ordered.slice(1, 4).map(([name]) => name);
    lines.push({
      template: "languages",
      text:
        `${primary[0]} carries ${primary[1]} of the ${entries.length} entries` +
        (rest.length ? `, with ${list(rest)} alongside it.` : "."),
      evidence: ordered.map(([name, count]) => `${name} · ${count} entr${count === 1 ? "y" : "ies"}`),
    });
  }

  /* verification habits, counted rather than claimed */
  const tested = entries.filter((e) => factOf(e, "Tests") !== undefined);
  const ci = entries.filter((e) => factOf(e, "CI") === "success");
  if (tested.length > 0 || ci.length > 0) {
    const clauses: string[] = [];
    if (tested.length > 0) {
      clauses.push(`${tested.length} ${tested.length === 1 ? "carries" : "carry"} a test suite`);
    }
    if (ci.length > 0) {
      clauses.push(
        `${ci.length} ${ci.length === 1 ? "was" : "were"} green in continuous integration at the last reading`,
      );
    }
    lines.push({
      template: "verification",
      text: `Of ${plural(entries.length, "repository", "repositories")}, ${list(clauses)}.`,
      evidence: [
        ...tested.map((e) => `${e.name} · Tests ${factOf(e, "Tests")}`),
        ...ci.map((e) => `${e.name} · CI success`),
      ],
    });
  }

  /* authorship, stated before anyone checks the commit graph */
  const partial = entries.filter((e) => e.authorship.share !== null && e.authorship.share > 0 && e.authorship.share < 100);
  const none = entries.filter((e) => e.authorship.share === 0);
  if (partial.length > 0 || none.length > 0) {
    const clauses: string[] = [];
    if (partial.length > 0) {
      clauses.push(
        `${list(partial.map((e) => `${e.name} at ${e.authorship.share}% (${e.authorship.mine} of ${e.authorship.total} commits)`))}`,
      );
    }
    if (none.length > 0) {
      clauses.push(
        `${list(none.map((e) => e.name))} ${none.length === 1 ? "records" : "record"} no commits under this account at all`,
      );
    }
    lines.push({
      template: "authorship",
      text:
        `Authorship is counted from the commit graph rather than described: ${list(clauses)}. ` +
        `Where that figure is low it stays low on this page; the commit graph is one click away.`,
      evidence: [...partial, ...none].map((e) => `${e.name} · ${e.authorship.mine}/${e.authorship.total} commits`),
    });
  } else {
    lines.push({
      template: "authorship-sole",
      text:
        `Every catalogued entry is sole-authored — ${list(
          ranked.slice(0, 3).map((e) => `${e.name} ${e.authorship.mine}/${e.authorship.total}`),
        )}, and the rest read the same. Shared repositories are surveyed identically and would show ` +
        `their real percentage in this line.`,
      evidence: entries.map((e) => `${e.name} · ${e.authorship.mine}/${e.authorship.total} commits`),
    });
  }

  /* annotation state — which entries a human has said anything about */
  const annotated = entries.filter((e) => e.annotated);
  lines.push({
    template: "annotation",
    text:
      annotated.length === 0
        ? `No entry carries a hand-written thesis yet. The catalogue publishes without one.`
        : `${annotated.length} of ${entries.length} entries ${annotated.length === 1 ? "carries" : "carry"} a hand-written thesis. The other ` +
          `${entries.length - annotated.length} publish on measurement alone, which is the point: ` +
          `an entry does not wait for prose to exist.`,
    evidence: annotated.map((e) => `${e.name} · prose.json`),
  });

  return lines;
}

/** The three figures the hero counts to. All of them verifiable in the repo. */
export interface Readout {
  readonly catalogued: number;
  readonly lastRun: string;
  readonly topClass: string;
  readonly revisionCount: number;
  readonly meanComposite: number;
}

export function readout(cat: Catalogue, revisionCount: number): Readout {
  const composites = cat.entries.map((e) => e.composite);
  const mean = composites.length ? composites.reduce((a, b) => a + b, 0) / composites.length : 0;
  const ranked = [...cat.entries].sort((a, b) => b.composite - a.composite);
  return {
    catalogued: cat.entries.length,
    lastRun: cat.generated,
    topClass: ranked[0]?.classification ?? "—",
    revisionCount,
    meanComposite: Math.round(mean * 10) / 10,
  };
}
