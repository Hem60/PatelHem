import { readFileSync } from "node:fs";
import { join } from "node:path";
import { score } from "./score.mjs";
import { OUT } from "./gh.mjs";
const a = JSON.parse(readFileSync(join(OUT, "anchors.json"), "utf8"));
const m = JSON.parse(readFileSync(join(OUT, "raw.json"), "utf8"));
const ctx = { user: "", now: a.collected_at };
const pad = (s, n) => String(s).padEnd(n);
const n5 = v => v.toFixed(1).padStart(5);
console.log("\nCALIBRATION ANCHORS — where the scale's fixed points actually land\n");
console.log(pad("REPO", 26) + pad("STAB", 6) + pad("MASS", 6) + pad("ANOM", 6) + pad("LUMI", 6) + pad("CADE", 6) + pad("SCORE", 7) + "CLASS");
console.log("-".repeat(74));
const rows = [...a.repos.map(r => ({ ...score(r, ctx), tag: "anchor" })),
               ...m.repos.filter(r => r.name === "vakil").map(r => ({ ...score(r, ctx), tag: "yours" }))];
for (const s of rows.sort((x, y) => y.composite - x.composite)) {
  const ax = s.axes;
  console.log(pad((s.tag === "yours" ? "> " : "  ") + s.name, 26) +
    n5(ax.stability.value) + " " + n5(ax.mass.value) + " " + n5(ax.anomaly.value) + " " +
    n5(ax.luminosity.value) + " " + n5(ax.cadence.value) + "  " + n5(s.composite) + "  " + s.class);
}
console.log("\n  > = yours\n");
