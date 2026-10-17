/**
 * External shared work — repositories on somebody else's account.
 *
 * Reads pipeline/data/external.json, written by hand-run
 * `pipeline/scripts/external.mjs` rather than by the survey. The survey's
 * token is scoped to this repository and cannot read another account's
 * private repositories, so these figures are collected by someone who has
 * access and committed. That makes this the one file on the site a stranger
 * cannot reproduce, and the page says so rather than letting it pass as
 * though it were measured like everything else.
 *
 * Optional on disk. An account with no external shared work has no file, and
 * the strip renders without the section rather than failing the build.
 *
 * Validated on read like every other file here. Server-only.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const CONTENT = join(process.cwd(), "..", "pipeline", "data");

const externalSchema = z.object({
  name: z.string(),
  /** The account that owns it. Never the owner of this site. */
  owner: z.string(),
  /** The owner's own sentence about it, not one written here. */
  description: z.string().nullable(),
  /** Private work is badged, and carries less detail. See external.mjs. */
  private: z.boolean(),
  /** Null for a private repository: there is no link a reader could open. */
  url: z.string().nullable(),
  share: z.number(),
  commits: z.object({
    mine: z.number(),
    total: z.number(),
    substantive: z.number(),
  }),
  excluded: z.object({ merges: z.number(), boilerplate: z.number() }),
  span: z.object({ from: z.string(), to: z.string() }).nullable(),
  /** The REPOSITORY's languages, every author's. Labelled as such. */
  stack: z.array(z.object({ name: z.string(), bytes: z.number() })),
  authors: z.array(z.object({ login: z.string(), count: z.number() })),
});

const fileSchema = z.object({
  generated: z.string(),
  owner: z.string(),
  collectedBy: z.string(),
  external: z.array(externalSchema),
});

export type External = z.infer<typeof externalSchema>;
export type ExternalFile = z.infer<typeof fileSchema>;

export function external(): ExternalFile | null {
  const path = join(CONTENT, "external.json");
  if (!existsSync(path)) return null;
  return fileSchema.parse(JSON.parse(readFileSync(path, "utf8")));
}
