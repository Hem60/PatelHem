/**
 * The site's data contract.
 *
 * The catalogue is written by the pipeline and read here. It is never edited
 * by hand, so the only sensible posture is to distrust the shape and validate
 * it at build time: if the pipeline ever writes a field this page does not
 * understand, the build fails rather than the page rendering a blank.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { CLASSES, type Classification } from "./bands";

const DATA = join(process.cwd(), "..", "pipeline", "data");

export type { Classification };

const classification = z.enum(CLASSES);

const factSchema = z.object({ label: z.string(), value: z.string() });

const entrySchema = z.object({
  name: z.string(),
  classification,
  composite: z.number(),
  axes: z.record(z.string(), z.number()),
  /*
   * The named components behind each axis reading, published by the pipeline
   * so the assay can show a receipt rather than a number. Optional, because a
   * catalogue written before the field existed must still load — the assay
   * falls back to the survey's sentences when it is absent.
   */
  parts: z.record(z.string(), z.record(z.string(), z.number())).optional(),
  thesis: z.string().nullable(),
  annotated: z.boolean(),
  summary: z.array(z.string()),
  facts: z.array(factSchema),
  stack: z.array(z.string()),
  authorship: z.object({
    share: z.number().nullable(),
    mine: z.number(),
    total: z.number(),
  }),
  links: z.object({ code: z.string(), live: z.string().nullable() }),
  updated: z.string(),
});

const stateSchema = z.object({
  current: classification,
  since: z.string(),
  history: z.array(z.number()),
  axesAtGrant: z.record(z.string(), z.number()),
  compositeAtGrant: z.number(),
});

const catalogueSchema = z.object({
  user: z.string(),
  generated: z.string(),
  /* the engine's component maxima, published with the readings */
  partMax: z.record(z.string(), z.record(z.string(), z.number())).optional(),
  entries: z.array(entrySchema),
  state: z.record(z.string(), stateSchema).default({}),
});

const revisionSchema = z.object({
  date: z.string(),
  repo: z.string(),
  from: classification,
  to: classification,
  compositeFrom: z.number(),
  compositeTo: z.number(),
  cause: z.object({
    axis: z.string(),
    from: z.number(),
    to: z.number(),
    evidence: z.array(z.string()),
  }),
  line: z.string().optional(),
});

const revisionsSchema = z.object({ revisions: z.array(revisionSchema) });

export type Entry = z.infer<typeof entrySchema>;
export type Catalogue = z.infer<typeof catalogueSchema>;
export type Revision = z.infer<typeof revisionSchema>;

function read(file: string): unknown {
  return JSON.parse(readFileSync(join(DATA, file), "utf8"));
}

export function catalogue(): Catalogue {
  return catalogueSchema.parse(read("catalogue.json"));
}

export function revisions(): Revision[] {
  const parsed = revisionsSchema.parse(read("revisions.json"));
  return [...parsed.revisions].sort((a, b) => b.date.localeCompare(a.date));
}

/** Hand-written thesis lines. The one part of the catalogue a person writes. */
export function prose(): Record<string, string> {
  return z.record(z.string(), z.string()).parse(read("prose.json"));
}

/** Entries, loudest first. Rank, then composite — the catalogue's own order. */
export function entriesByRank(cat: Catalogue): Entry[] {
  return [...cat.entries].sort((a, b) => b.composite - a.composite);
}
