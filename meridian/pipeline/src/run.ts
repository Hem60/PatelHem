#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isCatalogueEntry, languageCounts, score,
  type ScoreContext, type ScoredRepo, type Signals,
} from "@meridian/engine";
import {
  dominantAxis, emptyCatalogue,
  type Catalogue, type Entry, type Revision, type RevisionLog,
} from "./catalogue.js";
import { composeEntry, type Prose } from "./compose.js";
import { advance, diff, type Change } from "./diff.js";
import { detectRenames, migrateKeys, rewriteNames } from "./rename.js";
import { loadSignals } from "./load.js";
import { PART_MAX } from "@meridian/engine";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(HERE, "../data");

const argv = process.argv.slice(2);
const has = (f: string): boolean => argv.includes(f);
const flag = (f: string): string | undefined => {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : undefined;
};

const DRY = has("--dry-run");
/*
 * Republish from unchanged readings.
 *
 * The run normally exits when nothing moved, which is right: a survey that
 * rewrites the catalogue on every invocation makes `generated` meaningless.
 * But when the published SHAPE changes — a new field on Entry, say — the
 * readings are identical and the file still has to be rewritten. This forces
 * that, and it cannot invent a change: it re-emits exactly what the same
 * signals produce, and the revisions log stays untouched because no class
 * moved.
 */
const REBUILD = has("--rebuild");
const ONLY = flag("--repo");
const RAW = flag("--data") ?? resolve(HERE, "../../phase00/out/raw.json");

function readJson<T>(path: string, fallback: T): T {
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : fallback;
}

const log = (s = ""): void => { console.log(s); };
const stage = (name: string, msg: string): void => { console.log("  " + name.padEnd(11) + msg); };

// ---- 01 collect -----------------------------------------------------------
log();
log("  MERIDIAN SURVEY" + (DRY ? "  ·  dry run, nothing will be written" : ""));
log();
const { user, collectedAt, repos, ids } = loadSignals(RAW);
stage("01 collect", repos.length + " repositories read");

// ---- 02 measure -----------------------------------------------------------
const ctx: ScoreContext = { user, languageCounts: languageCounts(repos), now: collectedAt };
const catalogueRepos: Signals[] = repos.filter(r => isCatalogueEntry(r, user));
const selected = ONLY
  ? catalogueRepos.filter(r => r.name.toLowerCase() === ONLY.toLowerCase())
  : catalogueRepos;
if (ONLY !== undefined && selected.length === 0) {
  console.error("  no repository named " + ONLY);
  process.exit(1);
}
const scored: ScoredRepo[] = selected.map(r => score(r, ctx));
stage("02 measure", scored.length + " scored · five axes · no model involved");

// ---- 03 diff --------------------------------------------------------------
const catPath = resolve(DATA, "catalogue.json");
const revPath = resolve(DATA, "revisions.json");
const proseOnDisk = readJson<Prose>(resolve(DATA, "prose.json"), {});
const previous = readJson<Catalogue>(catPath, emptyCatalogue(user, collectedAt));

/* reassigned only when a rename moves state onto a new key */
let previousState: Catalogue["state"] = previous.state;

/*
 * Renames, before anything else looks at a name.
 *
 * A repository that kept its GitHub id and changed its name is the same
 * project. Everything keyed by name by hand has to follow it, or the next
 * stage sees the old entry vanish and a new one appear: the class history is
 * lost, the grant date resets, and the hysteresis that stops a project
 * flickering between bands starts again from nothing.
 *
 * Detected by id only. A name match proves nothing and a heuristic would
 * eventually migrate one project's history onto another.
 */
const renames = detectRenames(previous, ids);
let prose: Prose = proseOnDisk;

if (renames.length > 0) {
  for (const r of renames) stage("", "renamed: " + r.from + " → " + r.to + " (id " + r.id + ")");

  /* the class history, so a rename does not read as a new repository */
  const migratedState = migrateKeys(previous.state, renames);
  if (migratedState.moved.length > 0) {
    previousState = migratedState.next;
    stage("", "  carried the class history: " + migratedState.moved.join(", "));
  }

  /* the drafted or hand-written thesis lines */
  const migratedProse = migrateKeys(proseOnDisk, renames);
  if (migratedProse.moved.length > 0) {
    prose = migratedProse.next;
    writeFileSync(
      resolve(DATA, "prose.json"),
      JSON.stringify(
        Object.fromEntries(Object.keys(migratedProse.next).sort().map(k => [k, migratedProse.next[k]!])),
        null,
        2,
      ) + "\n",
    );
    stage("", "  moved prose: " + migratedProse.moved.join(", "));
  }

  /*
   * The authored evidence lines in the site's skill set. There is no key to
   * move here — a person wrote the repository name inside a sentence — so the
   * name is replaced in the text. Leaving it stale fails the build, which is
   * correct but unhelpful: a skill citing a repository the catalogue does not
   * hold is a claim with nothing behind it.
   */
  const skillsPath = resolve(DATA, "..", "..", "site", "content", "skills.json");
  if (existsSync(skillsPath)) {
    const before = readFileSync(skillsPath, "utf8");
    const after = rewriteNames(before, renames);
    if (after !== before) {
      writeFileSync(skillsPath, after);
      stage("", "  rewrote the skill evidence in site/content/skills.json");
    }
  }
}

/*
 * A partial run must never publish.
 *
 * `--repo one-project` scores exactly one repository, and everything
 * downstream is built from what was scored: the catalogue would be rewritten
 * with a single entry and the state of every other project discarded. That
 * was true before removals were detected and merely latent; with removals it
 * would also report the rest of the account as deleted. It is a diagnostic
 * flag, so it reads and reports and writes nothing.
 */
const PARTIAL = ONLY !== undefined;

const { changes, dirty } = diff({ ...previous, state: previousState }, scored, collectedAt, {
  complete: !PARTIAL,
});

const removed = changes.filter(c => c.kind === "removed").map(c => c.repo);
if (removed.length > 0) {
  stage("", "no longer on the account: " + removed.join(", "));
  stage("", "  their cards come off the site with this publish");
}

const kinds: Record<string, number> = {};
for (const c of changes) kinds[c.kind] = (kinds[c.kind] ?? 0) + 1;
const summary = Object.entries(kinds).map(([k, n]) => n + " " + k).join(" · ");
stage("03 diff", summary === "" ? "nothing" : summary);

if (!dirty && !REBUILD) {
  stage("", "nothing moved — exiting without a commit");
  log();
  process.exit(0);
}
if (!dirty && REBUILD) {
  stage("", "nothing moved — republishing anyway (--rebuild)");
}

// ---- 04 compose -----------------------------------------------------------
const byName = new Map(selected.map(s => [s.name, s]));
const entries: Entry[] = [];
let rejectedCount = 0;
let upheldCount = 0;
for (const r of scored) {
  const signals = byName.get(r.name);
  if (signals === undefined) continue;
  const { entry, verification } = composeEntry(signals, r, prose, user, collectedAt);
  rejectedCount += verification.rejected.length;
  upheldCount += verification.upheld.length;
  entries.push(entry);
  for (const bad of verification.rejected) {
    stage("", "  plumb rejected " + bad.template + " on " + r.name + " — " + bad.rejection);
  }
}
stage("04 compose", entries.length + " entries · " + upheldCount + " claims upheld · " + rejectedCount + " rejected");
/*
 * Three states now, not two. An entry can carry the author's line, carry a
 * drafted one, or carry nothing — and reporting a drafted entry as having "no
 * thesis yet" was wrong the moment the drafter started writing.
 */
const drafted = entries.filter(e => e.thesisSource === "groq").map(e => e.name);
const blank = entries.filter(e => e.thesis === null).map(e => e.name);
if (drafted.length > 0) stage("", "drafted (not hand-written): " + drafted.join(", "));
if (blank.length > 0) stage("", "no thesis line at all: " + blank.join(", "));

// ---- 05 revise ------------------------------------------------------------
const priorEntries = new Map(previous.entries.map(e => [e.name, e]));
const revisionLog = readJson<RevisionLog>(revPath, { revisions: [] });
const fresh: Revision[] = [];

for (const c of changes as readonly Change[]) {
  if (c.kind !== "promote" && c.kind !== "demote") continue;
  const before = priorEntries.get(c.repo);
  // Explain the move against the state the class was granted in.
  const cause = dominantAxis(previous.state[c.repo]?.axesAtGrant ?? null, c.to);
  const priorAxis = cause.from;
  const headline =
    c.repo.toUpperCase() + " · " + c.fromClass + " → " + c.to.classification +
    " · " + cause.axis + " " + priorAxis + " → " + cause.to;
  fresh.push({
    date: collectedAt.slice(0, 10),
    repo: c.repo,
    from: c.fromClass as Revision["from"],
    to: c.to.classification,
    compositeFrom: previous.state[c.repo]?.compositeAtGrant ?? before?.composite ?? 0,
    compositeTo: c.to.composite,
    cause,
    headline,
  });
  stage("05 revise", headline);
}
if (fresh.length === 0) stage("05 revise", "no class changes this run");

// ---- 06 publish -----------------------------------------------------------
const next: Catalogue = {
  user,
  generated: collectedAt,
  partMax: PART_MAX,
  entries: [...entries].sort((a, b) => b.composite - a.composite),
  state: advance({ ...previous, state: previousState }, scored, changes, collectedAt, undefined, ids),
};
const nextLog: RevisionLog = { revisions: [...fresh, ...revisionLog.revisions] };

if (PARTIAL) {
  /*
   * Refused, not silently truncated. Everything downstream is built from what
   * was scored, so publishing one repository would rewrite the catalogue with
   * a single entry and drop the state of every other project.
   */
  stage("06 publish", "refused — --repo scores one repository and cannot publish a catalogue");
  log();
  log("  " + scored.length + " scored, " + previous.entries.length + " in the published catalogue");
  log("  drop --repo to publish, or add --dry-run to silence this");
  log();
  process.exit(0);
}

if (DRY) {
  stage("06 publish", "skipped — dry run");
  log();
  log("  would write " + entries.length + " entries and " + fresh.length + " revisions");
  log();
  process.exit(0);
}
mkdirSync(DATA, { recursive: true });
writeFileSync(catPath, JSON.stringify(next, null, 2) + "\n");
writeFileSync(revPath, JSON.stringify(nextLog, null, 2) + "\n");
stage("06 publish", "wrote catalogue.json (" + entries.length + " entries) and revisions.json (" + nextLog.revisions.length + " total)");
log();
