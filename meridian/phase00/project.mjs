// What-if: apply cheap, real fixes and re-score. No threshold bending —
// this changes the repositories, not the ladder.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { score, THRESHOLDS } from "./score.mjs";
import { OUT } from "./gh.mjs";

const raw = JSON.parse(readFileSync(join(OUT, "raw.json"), "utf8"));
const ORDER = ["MYTHIC", "LEGENDARY", "EPIC", "RARE", "UNCOMMON", "COMMON"];
const langCounts = {};
for (const r of raw.repos) if (r.language) langCounts[r.language] = (langCounts[r.language] || 0) + 1;
const ctx = { user: raw.user, langCounts, now: raw.collected_at };

const FIXES = {
  license:  r => ({ ...r, license: "MIT" }),
  topics:   r => ({ ...r, topics: ["agents", "verification", "python"] }),
  describe: r => ({ ...r, description: r.description || "A described project." }),
  deploy:   r => ({ ...r, homepage: "https://example.invalid", homepage_status: 200 }),
  release:  r => ({ ...r, release_count: 1 }),
};

const apply = (r, keys) => keys.reduce((acc, k) => FIXES[k](acc), r);
const owned = raw.repos.filter(r => !r.fork);
const pad = (s, n) => String(s).padEnd(n);
const n5 = v => v.toFixed(1).padStart(5);

function report(title, keys) {
  const rows = owned.map(r => score(apply(r, keys), ctx));
  const dist = {}; for (const c of ORDER) dist[c] = rows.filter(s => s.class === c).length;
  const bands = ORDER.filter(c => dist[c] > 0).length;
  console.log(`\n${title}`);
  console.log(`  applied: ${keys.length ? keys.join(", ") : "nothing (baseline)"}`);
  for (const s of rows.sort((a, b) => b.composite - a.composite))
    console.log(`    ${pad(s.name.slice(0, 20), 21)} ${n5(s.composite)}  ${s.class}`);
  console.log(`  bands occupied: ${bands} of 6  ->  ${bands >= 3 ? "PASS" : "FAIL"}`);
  return bands;
}

report("BASELINE — today", []);
report("A · metadata only (10 minutes: description + topics + LICENSE on every repo)", ["license", "topics", "describe"]);
report("B · metadata + one deployment + one release", ["license", "topics", "describe", "deploy", "release"]);
console.log();
