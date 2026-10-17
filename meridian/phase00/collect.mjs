// Meridian phase 00 — collect every repo on an account.
//
// ── Two listings, and why it tries the narrower one first ───────────────────
// `/users/{name}/repos` is the public listing. It returns public repositories
// only, for everyone, and a token does not widen it. Private repositories live
// behind `/user/repos`, the authenticated-user endpoint, which needs a
// user-to-server token with `repo` scope.
//
// This used to call the public listing and nothing else, so a private
// repository was invisible: it was created, the survey button was pressed, the
// run went green, and the catalogue did not move with nothing saying why.
//
// Now it asks for the owned listing first and falls back. Which one answered
// is printed, because the difference decides whether a missing repository is a
// bug or the expected result of running without a token.
//
// ── The guard that matters ──────────────────────────────────────────────────
// `/user/repos` returns the repositories of whoever holds the token, not of
// the account named on the command line. Running it while authenticated as
// somebody else would silently collect the wrong account and publish it as
// this one. So the token's login is checked against USER first, and anything
// but an exact match falls back to the public listing.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { api, collectRepo, OUT } from "./gh.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const USER = process.argv[2] || "Hem60";

/**
 * Repositories to drop before anything is requested for them.
 *
 * Collecting private repositories means a card on a public site carries the
 * name, description, file paths and commit counts of whatever is listed. This
 * is the control for that, and it is applied at collection rather than at
 * publication so nothing about an excluded repository reaches raw.json, the
 * catalogue or the site — not even a row saying it was skipped by name.
 */
const EXCLUDE = (() => {
  try {
    const list = JSON.parse(readFileSync(join(HERE, "exclude.json"), "utf8")).repos ?? [];
    return new Set(list.map(n => String(n).toLowerCase()));
  } catch {
    return new Set();
  }
})();

/** Page a listing until it returns a short page. */
function paged(make) {
  const all = [];
  for (let page = 1; page <= 10; page += 1) {
    const batch = api(make(page));
    if (batch.__error) return batch.__error && all.length === 0 ? batch : all;
    if (!Array.isArray(batch)) return all;
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

/**
 * The owned listing, when the token is this account's. Null when it is not
 * available — no token, the wrong token, or one without `repo` scope.
 */
function owned() {
  const me = api("user");
  if (me.__error || typeof me.login !== "string") return null;
  if (me.login.toLowerCase() !== USER.toLowerCase()) {
    console.error(
      `  token belongs to ${me.login}, not ${USER} — using the public listing instead`,
    );
    return null;
  }
  /* owner only: collaborator and organisation repos are not this account's */
  const list = paged(p => `user/repos?per_page=100&affiliation=owner&sort=updated&page=${p}`);
  return list.__error ? null : list;
}

const fromOwned = owned();
const repos = fromOwned ?? api(`users/${USER}/repos?per_page=100&sort=updated`);
if (repos.__error) { console.error("could not list repos"); process.exit(1); }

const mode = fromOwned ? "owned" : "public";

const collected = [];
let skipped = 0;
for (const r of repos) {
  if (EXCLUDE.has(r.name.toLowerCase())) {
    /* counted, never named: a public log naming an excluded private
       repository would leak the one thing the exclusion protects */
    skipped += 1;
    continue;
  }
  process.stderr.write(`  collecting ${r.full_name}${r.private ? " (private)" : ""}\n`);
  collected.push(await collectRepo(r));
}

writeFileSync(join(OUT, "raw.json"),
  JSON.stringify({
    user: USER,
    collected_at: new Date().toISOString(),
    /* which listing answered. The site says so rather than implying the
       catalogue is everything on the account when it may not be. */
    listing: mode,
    repos: collected,
  }, null, 2));

const priv = collected.filter(r => r.private).length;
console.log(
  `collected ${collected.length} repos (${priv} private) -> out/raw.json` +
  (skipped > 0 ? ` · ${skipped} excluded by phase00/exclude.json` : ""),
);

if (mode === "owned") {
  console.log(`  listing: user/repos — public and private, owned by ${USER}`);
} else {
  console.log(
    `  listing: users/${USER}/repos — PUBLIC ONLY.` +
    `\n  No token with repo scope, so a private repository is invisible and will` +
    `\n  not appear in the catalogue. See DEPLOY.md, "Private repositories".`,
  );
}
