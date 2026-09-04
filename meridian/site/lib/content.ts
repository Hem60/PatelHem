/**
 * Author-supplied content, validated the same way the catalogue is.
 *
 * Everything in content/ is written by a person. Everything in
 * pipeline/data/ is written by the pipeline. Keeping them in separate
 * directories with separate loaders is how the page stays honest about which
 * sentences are claims and which are measurements.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const CONTENT = join(process.cwd(), "content");

const positionSchema = z.object({
  id: z.string(),
  label: z.string(),
  gloss: z.string(),
  paragraphs: z.array(z.string()).min(1),
});

const parallaxSchema = z.object({
  authored: z.literal(true),
  positions: z.array(positionSchema).min(1),
});

const recordSchema = z.object({
  /** Start of the entry. "YYYY" or "YYYY-MM" — a calendar label, not an instant. */
  date: z.string(),
  /** End of the entry, when it has one. Absent for a point in time. */
  until: z.string().optional(),
  title: z.string(),
  detail: z.string(),
  /**
   * What the entry actually was, in the author's words.
   *
   * Optional, and the timeline renders without it. It exists because `detail`
   * is one line for the institution and there is nowhere else to say what the
   * years were spent on — but an entry nobody has written up should print
   * nothing rather than a filler sentence.
   */
  summary: z.string().optional(),
  kind: z.enum(["education", "award", "appointment", "release"]),
  /** Short bordered labels under the entry. Institution, subject, status. */
  tags: z.array(z.string()).default([]),
  source: z.string().optional(),
});

const logSchema = z.object({ record: z.array(recordSchema) });

/**
 * A self-assessed skill level.
 *
 * The only number on this page a person sets. `evidence` is required and
 * printed beside the level, so even the authored list carries something a
 * reader can check.
 */
/**
 * The skill groups, in the order the dossier prints them.
 *
 * One group per row of the panel. `evidence` stays required for every entry in
 * every group — that requirement is the only thing separating this panel from
 * a list of technologies its author would like to be associated with, and it
 * is what `npm test` checks.
 */
export const SKILL_KINDS = [
  "language",
  "agentic",
  "ai",
  "ml",
  "evaluation",
  "backend",
  "frontend",
  "data",
  "quality",
  "ops",
  "domain",
  "practice",
  "tool",
] as const;

const skillSchema = z.object({
  name: z.string(),
  /**
   * A self-assessed level, 0-100.
   *
   * Optional, and deliberately so. Entries measured against the catalogue
   * carry one; entries taken from the resume do not, because the resume does
   * not state proficiencies and inventing a number for each would be the
   * exact kind of unbacked figure this file exists to prevent.
   */
  level: z.number().min(0).max(100).optional(),
  kind: z.enum(SKILL_KINDS),
  /**
   * Where the claim comes from, and what it has to satisfy.
   *
   * `catalogue` — evidenced by a repository the survey can read. Its evidence
   *   line must name one, and a language entry must appear in some stack.
   * `resume` — the author states it and the catalogue cannot corroborate it.
   *   Its evidence line must cite the resume section it came from, and the
   *   panel marks it so a reader can tell the two apart.
   */
  source: z.enum(["catalogue", "resume"]).default("catalogue"),
  evidence: z.string().min(1),
});

const skillsSchema = z.object({ skills: z.array(skillSchema) });

export type Skill = z.infer<typeof skillSchema>;

export type Position = z.infer<typeof positionSchema>;
export type RecordEntry = z.infer<typeof recordSchema>;

function read(file: string): unknown {
  return JSON.parse(readFileSync(join(CONTENT, file), "utf8"));
}

export function positions(): Position[] {
  return parallaxSchema.parse(read("parallax.json")).positions;
}

export function record(): RecordEntry[] {
  return [...logSchema.parse(read("log.json")).record].sort((a, b) => b.date.localeCompare(a.date));
}

/** Author-supplied skill levels, strongest first. */
export function skills(): Skill[] {
  return [...skillsSchema.parse(read("skills.json")).skills].sort((a, b) => {
    /* measured before stated, then by level, then alphabetically */
    if (a.source !== b.source) return a.source === "catalogue" ? -1 : 1;
    if (a.level !== b.level) return (b.level ?? -1) - (a.level ?? -1);
    return a.name.localeCompare(b.name);
  });
}
