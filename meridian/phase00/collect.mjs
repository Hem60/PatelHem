// Meridian phase 00 — collect every repo on an account.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { api, collectRepo, OUT } from "./gh.mjs";

const USER = process.argv[2] || "Hem60";
const repos = api(`users/${USER}/repos?per_page=100&sort=updated`);
if (repos.__error) { console.error("could not list repos"); process.exit(1); }

const collected = [];
for (const r of repos) {
  process.stderr.write(`  collecting ${r.full_name}\n`);
  collected.push(await collectRepo(r));
}
writeFileSync(join(OUT, "raw.json"),
  JSON.stringify({ user: USER, collected_at: new Date().toISOString(), repos: collected }, null, 2));
console.log(`collected ${collected.length} repos -> out/raw.json`);
