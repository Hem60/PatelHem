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
const { user, collectedAt, repos } = loadSignals(RAW);
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
const prose = readJson<Prose>(resolve(DATA, "prose.json"), {});
const previous = readJson<Catalogue>(catPath, emptyCatalogue(user, collectedAt));
const { changes, dirty } = diff(previous, scored, collectedAt);

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
  state: advance(previous, scored, changes, collectedAt),
};
const nextLog: RevisionLog = { revisions: [...fresh, ...revisionLog.revisions] };

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
