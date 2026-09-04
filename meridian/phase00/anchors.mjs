// Fixed points for the scale. Without these, "is 55 good?" has no answer.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { api, collectRepo, OUT } from "./gh.mjs";
const list = process.argv.slice(2);
const repos = [];
for (const full of list) {
  process.stderr.write(`  ${full}\n`);
  const meta = api(`repos/${full}`);
  if (meta.__error) { process.stderr.write(`    unavailable\n`); continue; }
  repos.push(await collectRepo(meta));
}
writeFileSync(join(OUT, "anchors.json"), JSON.stringify({ user: "anchors", collected_at: new Date().toISOString(), repos }, null, 2));
console.log(`anchored ${repos.length}`);
