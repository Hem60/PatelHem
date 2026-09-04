/**
 * Console tests.
 *
 * The console is the easiest surface on the page to let drift: it prints in a
 * different shape from the sections, so a stale command would go unnoticed.
 * These pin every command to the same data the page renders.
 */
import { describe, expect, it } from "vitest";
import { catalogue } from "../lib/catalogue";
import { record, skills } from "../lib/content";
import { OWNER } from "../lib/owner";
import { span } from "../lib/format";
import { CHIPS, COMMANDS, run, type ConsoleLine } from "../lib/console";

const cat = catalogue();
const ctx = { cat, record: record(), skills: skills(), owner: OWNER };

const linesOf = (input: string): ConsoleLine[] => run(input, ctx).lines;

const cells = (input: string): string[][] =>
  linesOf(input)
    .filter((l) => l.kind === "row")
    .map((l) => [...(l.cells ?? [])]);

describe("the command surface", () => {
  it("names every command once, and every chip is a real command", () => {
    const names = COMMANDS.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    for (const chip of CHIPS) expect(names).toContain(chip);
  });

  it("says so when a command does not exist", () => {
    const out = linesOf("sudo rm -rf /");
    expect(out[0]?.kind).toBe("error");
    expect(out[0]?.text).toContain("not a command");
  });

  it("returns nothing for an empty line", () => {
    expect(run("   ", ctx).lines).toEqual([]);
  });

  it("prints the index in the order it was specified", () => {
    expect(cells("help").map(([usage]) => usage)).toEqual([
      "whoami",
      "projects",
      "open <name>",
      "skills",
      "education",
      "awards",
      "find <query>",
      "contact",
      "clear",
    ]);
  });

  it("still runs the commands help does not list", () => {
    for (const c of COMMANDS.filter((x) => !x.listed)) {
      expect(linesOf(c.name).length, c.name).toBeGreaterThan(0);
    }
  });
});

describe("projects", () => {
  const rows = cells("projects").slice(1); /* drop the header row */

  it("lists every catalogued repository, strongest first", () => {
    expect(rows.length).toBe(cat.entries.length);
    const ranked = [...cat.entries].sort((a, b) => b.composite - a.composite);
    expect(rows.map((r) => r[0])).toEqual(ranked.map((e) => e.name));
  });

  it("prints the class and score the catalogue published", () => {
    for (const r of rows) {
      const entry = cat.entries.find((e) => e.name === r[0])!;
      expect(r[1]).toBe(entry.classification.toLowerCase());
      expect(r[2]).toBe(`${Math.round(entry.composite)}/100`);
    }
  });

  it("prints computed authorship rather than assuming it", () => {
    for (const r of rows) {
      const entry = cat.entries.find((e) => e.name === r[0])!;
      expect(r[3]).toBe(entry.authorship.share === null ? "unknown" : `${entry.authorship.share}%`);
    }
  });
});

describe("open", () => {
  it("asks for a repository when given none", () => {
    expect(linesOf("open")[0]?.kind).toBe("error");
    expect(run("open", ctx).open).toBeUndefined();
  });

  it("refuses a repository the catalogue does not hold", () => {
    expect(linesOf("open not-a-repo")[0]?.kind).toBe("error");
    expect(run("open not-a-repo", ctx).open).toBeUndefined();
  });

  it("hands back the repository's own URL, never one it made up", () => {
    const entry = cat.entries[0]!;
    expect(run(`open ${entry.name}`, ctx).open).toBe(entry.links.code);
  });

  it("is case-insensitive about the repository name", () => {
    const entry = cat.entries[0]!;
    expect(run(`open ${entry.name.toUpperCase()}`, ctx).open).toBe(entry.links.code);
  });
});

describe("skills", () => {
  const rows = cells("skills");

  it("prints every authored skill, measured ones first and strongest first", () => {
    expect(rows.length).toBe(ctx.skills.length);
    /* levelled entries lead; resume entries print a dot and follow */
    const levels = ctx.skills.filter((s) => s.level !== undefined).map((s) => s.level!);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]!).toBeLessThanOrEqual(levels[i - 1]!);
    }
    const firstUnlevelled = ctx.skills.findIndex((s) => s.level === undefined);
    if (firstUnlevelled >= 0) {
      for (const s of ctx.skills.slice(firstUnlevelled)) {
        expect(s.level, `${s.name} is levelled but sorted after an unlevelled one`).toBeUndefined();
      }
    }
  });

  it("prints the level and the name, and nothing else", () => {
    for (const r of rows) expect(r.length, r[1]).toBe(2);
  });

  it("still requires evidence behind every level, printed or not", () => {
    /* the column is gone from the output; the discipline is not. */
    for (const s of ctx.skills) expect(s.evidence.length, s.name).toBeGreaterThan(0);
  });

  it("names a repository the catalogue holds in every evidence line", () => {
    /*
     * Meridian itself counts.
     *
     * The catalogue excludes this repository — it publishes the others — but a
     * skill evidenced by the thing the reader is currently looking at is the
     * most checkable claim on the page, not the least. Naming it, or one of
     * its parts, satisfies the rule. Nothing else does: the point of this test
     * is that a level cannot cite work that does not exist.
     */
    const SELF = ["Meridian", "meridianplan", "engine", "pipeline", "Plumb"];
    const names = [...cat.entries.map((e) => e.name), ...SELF];
    for (const skill of ctx.skills.filter((s) => s.source === "catalogue")) {
      const cites = names.some((n) => skill.evidence.includes(n));
      const counts = /\d+ of \d+/.test(skill.evidence);
      expect(cites || counts, `${skill.name}: ${skill.evidence}`).toBe(true);
    }
  });

  it("makes every resume-sourced skill say it came from the resume", () => {
    /*
     * The resume strand is the one place the catalogue cannot corroborate a
     * claim, so the rule is that it must name its source instead. Without this
     * an unbacked entry could be added with a vague sentence and nothing would
     * notice — which is how the panel would quietly stop meaning anything.
     */
    for (const skill of ctx.skills.filter((s) => s.source === "resume")) {
      expect(skill.evidence, `${skill.name}: ${skill.evidence}`).toMatch(/^Resume — /);
      expect(skill.level, `${skill.name} carries a level the resume never stated`).toBeUndefined();
    }
  });

  it("does not claim a MEASURED language no repository uses", () => {
    /*
     * Scoped to the catalogue strand. A resume language is the author's own
     * statement and the survey has nothing to check it against — it is marked
     * as stated on the panel instead, which is the honest handling. What this
     * still catches is a language claiming to be measured when it is not.
     */
    const stacks = new Set(cat.entries.flatMap((e) => e.stack.map((x) => x.toLowerCase())));
    for (const skill of ctx.skills.filter((s) => s.kind === "language" && s.source === "catalogue")) {
      const claimed = skill.name.toLowerCase().split(/[^a-z+#.]+/).filter(Boolean);
      const backed = claimed.some((word) => [...stacks].some((s) => s.includes(word)));
      expect(backed, `${skill.name} is not in any repository's stack`).toBe(true);
    }
  });
});

describe("contact", () => {
  const rows = cells("contact");

  it("prints exactly the three ways to reach him", () => {
    expect(rows.map((r) => r[0])).toEqual(["email", "github", "linkedin"]);
  });

  it("prints the real addresses, and links them", () => {
    expect(rows.find((r) => r[0] === "email")?.[1]).toBe(OWNER.email);
    expect(rows.find((r) => r[0] === "github")?.[1]).toBe(OWNER.github);
    expect(rows.find((r) => r[0] === "linkedin")?.[1]).toBe(OWNER.linkedin);

    const hrefs = linesOf("contact").map((l) => l.href);
    expect(hrefs).toContain(OWNER.github);
    expect(hrefs).toContain(OWNER.linkedin);
    expect(hrefs).toContain(`mailto:${OWNER.email}`);
  });
});

describe("find", () => {
  it("asks for a query when given none", () => {
    expect(linesOf("find")[0]?.kind).toBe("error");
  });

  it("ranks matches, highest first", () => {
    const scores = cells("find python").map((r) => Number(r[0]));
    expect(scores.length).toBeGreaterThan(0);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]!).toBeLessThanOrEqual(scores[i - 1]!);
    }
  });

  it("only returns things that actually match", () => {
    for (const r of cells("find python")) {
      const slug = r[2]!.toLowerCase();
      const detail = r[3]!.toLowerCase();
      const entry = cat.entries.find((e) => e.name.toLowerCase() === slug);
      const matched =
        slug.includes("python") ||
        detail.includes("python") ||
        (entry?.stack.some((s) => s.toLowerCase().includes("python")) ?? false);
      expect(matched, `${r[2]} does not match`).toBe(true);
    }
  });

  it("says plainly when nothing matches", () => {
    expect(linesOf("find zzzznothing")[0]?.text).toContain("No match");
  });
});

describe("the honest empty states", () => {
  it("reports the owner the catalogue was built for", () => {
    const rows = cells("whoami");
    expect(rows.find((r) => r[0] === "handle")?.[1]).toBe(OWNER.handle);
    expect(rows.find((r) => r[0] === "catalogued")?.[1]).toBe(`${cat.entries.length} repositories`);
  });
});

describe("education", () => {
  const rows = cells("education");

  it("prints every degree the record holds", () => {
    const degrees = ctx.record.filter((r) => r.kind === "education");
    expect(degrees.length).toBeGreaterThan(0);
    /* one row for the span and title, one for the detail beneath it */
    expect(rows.length).toBe(degrees.length * 2);
    for (const d of degrees) {
      expect(rows.some((r) => r[1] === d.title), d.title).toBe(true);
      expect(rows.some((r) => r[1] === d.detail), d.detail).toBe(true);
    }
  });

  it("prints the span the way a person writes it", () => {
    expect(rows.map((r) => r[0]).filter(Boolean)).toEqual(
      ctx.record
        .filter((r) => r.kind === "education")
        .map((r) => span(r.date, r.until)),
    );
  });

  it("orders the record newest first", () => {
    const dates = ctx.record.filter((r) => r.kind === "education").map((r) => r.date);
    expect([...dates].sort((a, b) => b.localeCompare(a))).toEqual(dates);
  });
});

describe("awards", () => {
  const rows = cells("awards");
  const written = ctx.record.filter((r) => r.kind === "award" || r.kind === "appointment");

  it("prints every award and appointment the record holds", () => {
    expect(written.length).toBeGreaterThan(0);
    expect(rows.length).toBe(written.length * 2);
    for (const w of written) {
      expect(rows.some((r) => r[1] === w.title), w.title).toBe(true);
      expect(rows.some((r) => r[1] === w.detail), w.detail).toBe(true);
    }
  });

  it("orders them newest first", () => {
    const dates = written.map((r) => r.date);
    expect([...dates].sort((a, b) => b.localeCompare(a))).toEqual(dates);
  });

  it("keeps the record strand out of the computed strands", () => {
    /* nothing author-supplied may leak into a rank, a claim or a capability */
    for (const w of written) {
      expect(cat.entries.some((e) => e.summary.includes(w.title))).toBe(false);
    }
  });
});

describe("span", () => {
  it("names the month, and leaves a bare year alone", () => {
    expect(span("2025-08", "2026-05")).toBe("Aug 2025 – May 2026");
    expect(span("2024", "2028")).toBe("2024 – 2028");
    expect(span("2025-08")).toBe("Aug 2025");
  });
});
