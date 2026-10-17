// Meridian phase 00 — collect every PUBLIC repo on an account.
//
// ── Why this can never see a private repository ─────────────────────────────
// `/users/{name}/repos` is the public listing. It returns public repositories
// only, and it does so regardless of who is authenticated — a token does not
// widen it. Private repositories live behind `/user/repos`, the
// authenticated-user endpoint, which needs a user-to-server token with `repo`
// scope.
//
// The survey workflow has no such token. It authenticates with GITHUB_TOKEN,
// an installation token scoped to this one repository, which cannot enumerate
// the owner's other repositories at all. The public endpoint works there
// precisely because it needs no scope.
//
// So a private repository is invisible to the survey twice over, and that is
// a property of the design rather than a bug to be fixed in passing: a ranked
// card for a repository nobody can clone is a score nobody can reproduce,
// which is the one claim this whole build rests on.
//
// It used to fail silently. A new private repository was created, the button
// was pressed, the run went green, and the catalogue did not move — with
// nothing anywhere saying why. The summary below is the fix for that part:
// the count is labelled public, every time, whether or not anything is
// missing.
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

console.log(`collected ${collected.length} PUBLIC repos -> out/raw.json`);
console.log(
  `  this is users/${USER}/repos, the public listing. A private repository is` +
  `\n  never surveyed and will not appear in the catalogue — make it public and` +
  `\n  the next run will rank it. See DEPLOY.md, "Private repositories".`,
);
