// Meridian phase 00 — calibration report.
// Scores the account, prints the distribution, and tests whether the ladder
// actually discriminates. Nothing else in the build may start until it does.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { score, classify, THRESHOLDS, WEIGHTS } from "./score.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(readFileSync(join(HERE, "out", "raw.json"), "utf8"));
const ORDER = ["MYTHIC", "LEGENDARY", "EPIC", "RARE", "UNCOMMON", "COMMON"];

const langCounts = {};
for (const r of raw.repos) if (r.language) langCounts[r.language] = (langCounts[r.language] || 0) + 1;
const ctx = { user: raw.user, langCounts, now: raw.collected_at };

const all = raw.repos.map(r => score(r, ctx));
// The catalogue is original work only: forks are someone else's history and
// the profile repo is infrastructure, not a project.
const owned = all.filter(s => !s.fork && s.name !== raw.user);
const forks = all.filter(s => s.fork);

const pad = (s, n) => String(s).padEnd(n);
const num = (v, n = 5) => String(typeof v === "number" ? v.toFixed(1) : v).padStart(n);

console.log(`\nMERIDIAN · PHASE 00 CALIBRATION`);
console.log(`account ${raw.user} · ${all.length} repos · ${owned.length} original · ${forks.length} forks`);
console.log(`collected ${raw.collected_at.slice(0, 16).replace("T", " ")}Z\n`);

console.log(pad("REPO", 22) + pad("STAB", 6) + pad("MASS", 6) + pad("ANOM", 6) + pad("LUMI", 6) + pad("CADE", 6) + pad("SCORE", 7) + pad("CLASS", 11) + "YOURS");
console.log("-".repeat(88));
for (const s of [...owned].sort((a, b) => b.composite - a.composite)) {
  const a = s.axes;
  console.log(
    pad(s.name.slice(0, 21), 22) +
    num(a.stability.value) + " " + num(a.mass.value) + " " + num(a.anomaly.value) + " " +
    num(a.luminosity.value) + " " + num(a.cadence.value) + "  " +
    num(s.composite, 5) + "  " + pad(s.class, 11) +
    (s.authorship.share === null ? "  —" : `  ${s.authorship.share}% (${s.authorship.mine}/${s.authorship.total})`)
  );
}
if (forks.length) {
  console.log("\nforks — excluded from the catalogue, kept for the contribution strand");
  for (const s of forks) {
    console.log("  " + pad(s.name.slice(0, 21), 22) +
      `score ${num(s.composite, 5)}  ` +
      (s.authorship.share === null ? "authorship —" : `your share ${s.authorship.share}% (${s.authorship.mine}/${s.authorship.total} commits)`));
  }
}

// ---- distribution ---------------------------------------------------------
const dist = {}; for (const c of ORDER) dist[c] = owned.filter(s => s.class === c).length;
console.log("\nDISTRIBUTION (original repos)");
for (const c of ORDER) {
  const n = dist[c];
  console.log("  " + pad(c, 11) + pad(n, 4) + "#".repeat(n * 4));
}

// ---- does the ladder discriminate? ---------------------------------------
const scores = owned.map(s => s.composite).sort((a, b) => a - b);
const spread = scores.at(-1) - scores[0];
const occupied = ORDER.filter(c => dist[c] > 0).length;
const top = Math.max(...scores);
console.log("\nDIAGNOSTICS");
console.log(`  spread            ${spread.toFixed(1)} points  (${scores[0].toFixed(1)} .. ${top.toFixed(1)})`);
console.log(`  bands occupied    ${occupied} of 6`);
console.log(`  median            ${scores[Math.floor(scores.length / 2)].toFixed(1)}`);

const verdict = [];
if (occupied < 3) verdict.push("FAIL  ladder does not discriminate — fewer than 3 bands occupied");
if (spread < 15) verdict.push("FAIL  scores are bunched — spread under 15 points");
if (top < THRESHOLDS.RARE) verdict.push("WARN  nothing reaches RARE; a public ranking would read as an admission");
if (dist.MYTHIC > 1) verdict.push("WARN  more than one mythic — thresholds are too kind");
if (!verdict.length) verdict.push("PASS  ladder discriminates on the current catalogue");
console.log("\nVERDICT");
for (const v of verdict) console.log("  " + v);

// ---- what moves next ------------------------------------------------------
console.log("\nNEAREST GATES");
for (const s of [...owned].sort((a, b) => b.composite - a.composite).slice(0, 4)) {
  const next = ORDER.slice().reverse().find(c => (THRESHOLDS[c] ?? -1) > s.composite);
  if (!next) continue;
  const gap = THRESHOLDS[next] - s.composite;
  const weakest = Object.entries(s.axes).sort((a, b) => a[1].value - b[1].value)[0];
  const need = gap / WEIGHTS[weakest[0]];
  console.log(`  ${pad(s.name.slice(0, 20), 21)} ${s.class} → ${pad(next, 10)} needs +${gap.toFixed(1)} composite`);
  console.log(`  ${" ".repeat(21)} weakest axis ${weakest[0]} at ${weakest[1].value.toFixed(1)} — +${need.toFixed(0)} there would do it`);
}

writeFileSync(join(HERE, "out", "scores.json"), JSON.stringify({ user: raw.user, scored_at: raw.collected_at, thresholds: THRESHOLDS, weights: WEIGHTS, repos: all }, null, 2));
console.log(`\nwrote out/scores.json\n`);
