#!/usr/bin/env node
import { loadCatalogue } from "./adapter.js";
import { classify, nextGate, ORDER, THRESHOLDS } from "./classify.js";
import { explain } from "./explain.js";
import { isCatalogueEntry, languageCounts, score } from "./score.js";
import type { Classification, ScoreContext, ScoredRepo } from "./signals.js";

const USAGE = `
meridian — deterministic repository classification

  meridian score [--data <path>] [--all]     table of the catalogue
  meridian why <repo> [--data <path>] [-v]   print the arithmetic
  meridian ladder                            the class thresholds

  --data   path to raw.json  (default ../phase00/out/raw.json)
  --all    include forks and the profile repository
  -v       show signals that scored zero
`;

const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const has = (name: string): boolean => argv.includes(name);

const dataPath = flag("--data")
  ?? new URL("../../phase00/out/raw.json", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

const pad = (s: string, n: number): string => s.padEnd(n);
const n5 = (v: number): string => v.toFixed(1).padStart(5);

function load(): { ctx: ScoreContext; rows: ScoredRepo[]; user: string; at: string } {
  const cat = loadCatalogue(dataPath);
  const ctx: ScoreContext = {
    user: cat.user,
    languageCounts: languageCounts(cat.repos),
    now: cat.collectedAt,
  };
  const chosen = has("--all") ? cat.repos : cat.repos.filter(r => isCatalogueEntry(r, cat.user));
  return { ctx, rows: chosen.map(r => score(r, ctx)), user: cat.user, at: cat.collectedAt };
}

function cmdScore(): void {
  const { rows, user, at } = load();
  rows.sort((a, b) => b.composite - a.composite);

  console.log(`\n  ${user} · ${rows.length} entries · collected ${at.slice(0, 16).replace("T", " ")}Z\n`);
  console.log("  " + pad("REPO", 22) + ["STAB", "MASS", "ANOM", "LUMI", "CADE"].map(h => pad(h, 6)).join("") + pad("SCORE", 7) + pad("CLASS", 11) + "YOURS");
  console.log("  " + "\u2500".repeat(86));
  for (const r of rows) {
    console.log(
      "  " + pad(r.name.slice(0, 21), 22) +
      n5(r.axes.stability.value) + " " + n5(r.axes.mass.value) + " " + n5(r.axes.anomaly.value) + " " +
      n5(r.axes.luminosity.value) + " " + n5(r.axes.cadence.value) + "  " +
      n5(r.composite) + "  " + pad(r.classification, 11) +
      (r.authorship.share === null ? "\u2014" : `${r.authorship.share}% (${r.authorship.mine}/${r.authorship.total})`),
    );
  }

  const dist = new Map<Classification, number>(ORDER.map(c => [c, 0]));
  for (const r of rows) dist.set(r.classification, (dist.get(r.classification) ?? 0) + 1);
  const occupied = [...dist.values()].filter(n => n > 0).length;
  console.log("\n  distribution");
  for (const c of ORDER) {
    const n = dist.get(c) ?? 0;
    console.log("    " + pad(c, 11) + String(n).padEnd(4) + "\u2588".repeat(n * 3));
  }
  console.log(`\n  ${occupied} of 6 bands occupied \u2014 ${occupied >= 3 ? "the ladder discriminates" : "TOO FLAT"}\n`);
}

function cmdWhy(): void {
  const target = argv[1];
  if (target === undefined) { console.error("  usage: meridian why <repo>"); process.exit(2); }
  const { rows } = load();
  const hit = rows.find(r => r.name.toLowerCase() === target.toLowerCase());
  if (!hit) {
    console.error(`  no entry named "${target}". known: ${rows.map(r => r.name).join(", ")}`);
    process.exit(1);
  }
  console.log(explain(hit, { verbose: has("-v") || has("--verbose") }));
}

function cmdLadder(): void {
  console.log("\n  class thresholds \u2014 calibrated against external anchors\n");
  for (const c of ORDER) {
    const lo = c === "COMMON" ? 0 : THRESHOLDS[c as Exclude<Classification, "COMMON">];
    console.log(`    ${pad(c, 11)} \u2265 ${String(lo).padStart(3)}`);
  }
  console.log(`\n  reference points: ossf/scorecard 78.2 \u00b7 a strong flagship ~67\n`);
  void classify; void nextGate;
}

switch (argv[0]) {
  case "score": cmdScore(); break;
  case "why": cmdWhy(); break;
  case "ladder": cmdLadder(); break;
  default: console.log(USAGE); process.exit(argv[0] === undefined ? 0 : 2);
}
