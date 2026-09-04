/**
 * The console's command set.
 *
 * Pure functions over the catalogue: a command takes what the page already
 * knows and returns lines. No I/O, no clock, no network — which means the
 * whole command surface is unit-testable, and `projects` prints the same
 * classes in the browser that the engine computed at build time.
 *
 * Everything here is reachable by scrolling too. The console is a faster way
 * through the same index, never the only way to something.
 */
import { AXES, type Classification } from "./bands";
import type { Catalogue, Entry } from "./catalogue";
import type { RecordEntry, Skill } from "./content";
import { capabilities } from "./evidence";
import { span } from "./format";
import { instrumentFor } from "./sigil";

export type Tone = "accent" | "dim" | "ok" | "warn" | "class";

/**
 * How wide the first column should be.
 *
 * Each row is its own grid, so columns cannot size themselves against other
 * rows — a shared template is what makes a block read as a table. This picks
 * which template: a two-digit level does not want the same lead column as
 * `find <query>` or `Aug 2025 – May 2026`.
 */
export type Lead = "num" | "label" | "date";

export interface ConsoleLine {
  readonly kind: "input" | "text" | "row" | "error" | "blank";
  readonly text?: string;
  /** Column cells, rendered in a fixed grid so output reads as a table. */
  readonly cells?: readonly string[];
  readonly tone?: Tone;
  /** Class name, when a row is tinted by rank. */
  readonly klass?: Classification;
  readonly href?: string;
  readonly lead?: Lead;
}

export interface ConsoleContext {
  readonly cat: Catalogue;
  /** The author-supplied record strand: education, awards, appointments. */
  readonly record: readonly RecordEntry[];
  /** The author-supplied skill levels. */
  readonly skills: readonly Skill[];
  readonly owner: {
    readonly name: string;
    readonly handle: string;
    readonly github: string;
    readonly linkedin: string;
    readonly email: string;
  };
}

/** What a command produced, and anything the caller has to do about it. */
export interface ConsoleResult {
  readonly lines: ConsoleLine[];
  /** A URL the console should open, when the command was `open`. */
  readonly open?: string;
}

const text = (t: string, tone?: Tone): ConsoleLine => ({ kind: "text", text: t, tone });
const blank = (): ConsoleLine => ({ kind: "blank" });
const error = (t: string): ConsoleLine => ({ kind: "error", text: t });
const row = (
  cells: string[],
  klass?: Classification,
  href?: string,
  lead?: Lead,
): ConsoleLine => ({ kind: "row", cells, klass, href, lead });

export interface Command {
  readonly name: string;
  readonly usage: string;
  readonly blurb: string;
  /** Shown as a chip under the console. */
  readonly chip: boolean;
  /** Listed by `help`. The extras are real, just not in the printed index. */
  readonly listed: boolean;
  readonly run: (args: string[], ctx: ConsoleContext) => ConsoleLine[];
  /** A URL this command asks the console to open, if any. */
  readonly opens?: (args: string[], ctx: ConsoleContext) => string | null;
}

const byRank = (cat: Catalogue): Entry[] => [...cat.entries].sort((a, b) => b.composite - a.composite);

const findEntry = (cat: Catalogue, name: string): Entry | undefined =>
  cat.entries.find((e) => e.name.toLowerCase() === name.toLowerCase());

export const COMMANDS: readonly Command[] = [
  {
    name: "help",
    usage: "help",
    blurb: "List the commands.",
    chip: true,
    listed: false,
    run: () => COMMANDS.filter((c) => c.listed).map((c) => row([c.usage, c.blurb])),
  },
  {
    name: "whoami",
    usage: "whoami",
    blurb: "who this is and what he does",
    chip: true,
    listed: true,
    run: (_args, { cat, owner }) => [
      row(["name", owner.name], undefined, undefined, "label"),
      row(["handle", owner.handle], undefined, undefined, "label"),
      row(["catalogued", `${cat.entries.length} repositories`], undefined, undefined, "label"),
      row(["last run", cat.generated.slice(0, 10)], undefined, undefined, "label"),
      blank(),
      text(
        "Every rank on this page is computed by a pure scoring function and every factual sentence is checked against a path that resolves. Nothing is self-reported.",
        "dim",
      ),
    ],
  },
  {
    name: "projects",
    usage: "projects",
    blurb: "list the indexed builds",
    chip: true,
    listed: true,
    run: (_args, { cat }) => {
      const entries = byRank(cat);
      return [
        row(["NAME", "CLASS", "SCORE", "AUTHORSHIP", "INSTRUMENT"]),
        ...entries.map((e) =>
          row(
            [
              e.name,
              e.classification.toLowerCase(),
              `${Math.round(e.composite)}/100`,
              e.authorship.share === null ? "unknown" : `${e.authorship.share}%`,
              instrumentFor(e).name.toLowerCase(),
            ],
            e.classification,
            e.links.code,
          ),
        ),
        blank(),
        text(`${entries.length} objects. Forks and the profile repository are excluded.`, "dim"),
      ];
    },
  },
  {
    name: "open",
    usage: "open <name>",
    blurb: "open a project's repository",
    chip: false,
    listed: true,
    run: (args, { cat }) => {
      const name = args[0];
      if (!name) return [error("open needs a repository. Try: open vakil")];
      const entry = findEntry(cat, name);
      if (!entry) return [error(`No entry called "${name}". Run projects for the list.`)];
      return [
        text(`Opening ${entry.name} in a new tab.`, "dim"),
        row(["url", entry.links.code], undefined, entry.links.code, "label"),
      ];
    },
    opens: (args, { cat }) => {
      const name = args[0];
      if (!name) return null;
      return findEntry(cat, name)?.links.code ?? null;
    },
  },
  {
    name: "skills",
    usage: "skills",
    blurb: "top capabilities by level",
    chip: true,
    listed: true,
    run: (_args, { skills }) => {
      if (skills.length === 0) return [text("Nothing recorded.", "warn")];
      /*
       * Level and name only. The evidence stays required in
       * content/skills.json and is checked by the tests — it just does not
       * belong in this column, which reads as a ranking and should stay one.
       */
      return skills.map((s) =>
        row([s.level === undefined ? "·" : String(s.level), s.name], undefined, undefined, "num"),
      );
    },
  },
  {
    name: "education",
    usage: "education",
    blurb: "degrees, in progress",
    chip: false,
    listed: true,
    run: (_args, { record }) => {
      const rows = record.filter((r) => r.kind === "education");
      if (rows.length === 0) {
        return [
          text("Nothing recorded.", "warn"),
          text(
            "Education is the one strand of this page a machine cannot compute, so it is written by hand in content/log.json or it is not shown at all. Nothing is invented to fill the gap.",
            "dim",
          ),
        ];
      }
      return rows.flatMap((r) => [
        row([span(r.date, r.until), r.title], undefined, r.source, "date"),
        row(["", r.detail], undefined, undefined, "date"),
      ]);
    },
  },
  {
    name: "awards",
    usage: "awards",
    blurb: "competitive results and appointments",
    chip: true,
    listed: true,
    run: (_args, { record }) => {
      const rows = record.filter((r) => r.kind === "award" || r.kind === "appointment");
      if (rows.length === 0) {
        return [
          text("Nothing recorded.", "warn"),
          text(
            "Awards and appointments are author-supplied, in content/log.json. An empty list here means none have been entered — not that the survey missed them.",
            "dim",
          ),
        ];
      }
      return rows.flatMap((r) => [
        row([span(r.date, r.until), r.title], undefined, r.source, "date"),
        row(["", r.detail], undefined, undefined, "date"),
      ]);
    },
  },
  {
    name: "find",
    usage: "find <query>",
    blurb: "search everything on this page",
    chip: true,
    listed: true,
    run: (args, { cat }) => {
      const query = args.join(" ").trim().toLowerCase();
      if (!query) return [error("find needs something to look for. Try: find tests")];

      const hits: { score: number; type: string; slug: string; detail: string }[] = [];

      for (const entry of byRank(cat)) {
        let score = 0;
        if (entry.name.toLowerCase().includes(query)) score += 3;
        if (entry.stack.some((s) => s.toLowerCase().includes(query))) score += 2;
        if (entry.thesis?.toLowerCase().includes(query)) score += 1.5;
        const claims = entry.summary.filter((s) => s.toLowerCase().includes(query));
        score += claims.length * 0.9;
        if (score > 0) {
          hits.push({
            score,
            type: "project",
            slug: entry.name,
            detail: claims[0] ?? `${entry.classification.toLowerCase()} · ${entry.stack.join(", ")}`,
          });
        }
      }

      for (const cap of capabilities(cat)) {
        if (!cap.label.toLowerCase().includes(query) && !cap.gloss.toLowerCase().includes(query)) {
          continue;
        }
        hits.push({
          score: 2 + cap.repos.length * 0.4,
          type: cap.category,
          slug: cap.label,
          detail: `evidenced by ${cap.repos.length} of ${cat.entries.length} — ${cap.repos.join(", ")}`,
        });
      }

      if (hits.length === 0) return [text(`No match for "${query}".`, "dim")];

      return [
        ...hits
          .sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug))
          .map((h) => row([h.score.toFixed(1), h.type, h.slug, h.detail])),
        blank(),
        text(`${hits.length} matches, ranked by where the query landed.`, "dim"),
      ];
    },
  },
  {
    name: "contact",
    usage: "contact",
    blurb: "how to reach him",
    chip: true,
    listed: true,
    run: (_args, { owner }) => [
      row(["email", owner.email], undefined, `mailto:${owner.email}`, "label"),
      row(["github", owner.github], undefined, owner.github, "label"),
      row(["linkedin", owner.linkedin], undefined, owner.linkedin, "label"),
    ],
  },
  {
    name: "clear",
    usage: "clear",
    blurb: "clear the screen",
    chip: false,
    listed: true,
    run: () => [],
  },
];

export const CHIPS = COMMANDS.filter((c) => c.chip).map((c) => c.name);

/** Parse and run. Unknown commands say so rather than failing silently. */
export function run(input: string, ctx: ConsoleContext): ConsoleResult {
  const trimmed = input.trim();
  if (trimmed === "") return { lines: [] };
  const [name, ...args] = trimmed.split(/\s+/);
  const command = COMMANDS.find((c) => c.name === name!.toLowerCase());
  if (!command) {
    return { lines: [error(`${name}: not a command. Run help for the list.`)] };
  }
  const lines = command.run(args, ctx);
  const opened = command.opens?.(args, ctx) ?? undefined;
  return opened ? { lines, open: opened } : { lines };
}
