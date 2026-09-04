/**
 * The contributions strand.
 *
 * Reads pipeline/data/contributions.json — shared repositories the catalogue
 * deliberately excludes, because scoring somebody else's repository as if it
 * were yours is the one thing this site exists not to do.
 *
 * Validated on read like every other file here: a contribution that arrives
 * malformed fails the build rather than rendering a hole. Server-only, because
 * it touches the filesystem.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const CONTENT = join(process.cwd(), "..", "pipeline", "data");

const contributionSchema = z.object({
  name: z.string(),
  url: z.string(),
  /** The repository this was forked from, when the API reported one. */
  upstream: z.string().nullable(),
  /** Whether it cleared both thresholds. A rejected entry still ships. */
  published: z.boolean(),
  /** Why it failed, in the generator's own words. Empty when published. */
  reasons: z.array(z.string()),
  share: z.number(),
  commits: z.object({
    mine: z.number(),
    total: z.number(),
    /** Single-parent, non-boilerplate. The only count worth printing. */
    substantive: z.number(),
  }),
  excluded: z.object({ merges: z.number(), boilerplate: z.number() }),
  span: z.object({ from: z.string(), to: z.string() }).nullable(),
  /** The REPOSITORY's languages, not the contribution's. Labelled as such. */
  stack: z.array(z.object({ name: z.string(), bytes: z.number() })),
  authors: z.array(z.object({ login: z.string(), count: z.number() })),
  /** The commit subjects. The detail on the page is the graph's own words. */
  work: z.array(z.object({ date: z.string(), subject: z.string() })),
});

const fileSchema = z.object({
  generated: z.string(),
  owner: z.string(),
  thresholds: z.object({
    minSubstantiveCommits: z.number(),
    minSharePercent: z.number(),
  }),
  mode: z.enum(["authenticated", "anonymous"]),
  contributions: z.array(contributionSchema),
});

export type Contribution = z.infer<typeof contributionSchema>;
export type Contributions = z.infer<typeof fileSchema>;

export function contributions(): Contributions {
  const raw = JSON.parse(readFileSync(join(CONTENT, "contributions.json"), "utf8"));
  return fileSchema.parse(raw);
}
