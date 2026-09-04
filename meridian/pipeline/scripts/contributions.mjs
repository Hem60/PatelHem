/**
 * The contributions survey.
 *
 * Writes pipeline/data/contributions.json: work the owner contributed to but
 * does not own — the forks and shared repositories the catalogue deliberately
 * excludes, because ranking somebody else's repository as if it were yours is
 * the exact thing this site exists not to do.
 *
 * ── What counts as substantive ──────────────────────────────────────────────
 * Raw commit count is not a measure of contribution. Of twelve commits on one
 * of these repositories, three were merges and one was "Initial commit" — so
 * the honest number is eight, and a panel printing twelve would be inflating
 * by half.
 *
 * A commit is substantive when it has exactly one parent (a merge has two or
 * more and represents no authored change) and its subject is not pure
 * boilerplate. A contribution publishes when it clears BOTH thresholds below.
 * Everything else is written to the file too, with the reason it failed —
 * a threshold you cannot see is a threshold you cannot check.
 *
 * Anonymous GitHub allows 60 requests an hour. This costs 2 per repository
 * plus 1 for the listing, so about 19 for a nine-repository account. Set
 * GITHUB_TOKEN to raise the ceiling to 5,000.
 *
 * Usage: node scripts/contributions.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "data", "contributions.json");

const OWNER = "Hem60";

/** Both must hold for a contribution to publish. */
const MIN_COMMITS = 5;
const MIN_SHARE = 10;

/** Subjects that represent no authored change. */
const BOILERPLATE = /^(initial commit|first commit|create readme(\.md)?|update readme(\.md)?)$/i;

const token = process.env.GITHUB_TOKEN?.trim();

async function api(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "meridian-contributions",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    throw new Error(
      `${res.status} on ${path}${remaining === "0" ? " — rate limit spent, nothing was written" : ""}`,
    );
  }
  return res.json();
}

/** Classify one commit: substantive, a merge, or boilerplate. */
function classify(commit) {
  if ((commit.parents?.length ?? 1) > 1) return "merge";
  const subject = (commit.commit?.message ?? "").split("\n")[0].trim();
  if (BOILERPLATE.test(subject)) return "boilerplate";
  return "substantive";
}

const repos = await api(`/users/${OWNER}/repos?per_page=100&sort=pushed`);

/*
 * Only shared work. The owner's own repositories are the catalogue's job; this
 * file is about the repositories where the interesting question is not "how
 * good is it" but "how much of it is actually yours".
 */
const shared = repos.filter((r) => r.fork);

const out = [];

for (const repo of shared) {
  const commits = await api(`/repos/${OWNER}/${repo.name}/commits?per_page=100`);
  const langs = await api(`/repos/${OWNER}/${repo.name}/languages`);

  const mine = commits.filter((c) => (c.author?.login ?? "").toLowerCase() === OWNER.toLowerCase());
  const kinds = { substantive: [], merge: [], boilerplate: [] };
  for (const c of mine) kinds[classify(c)].push(c);

  const share = commits.length === 0 ? 0 : Math.round((mine.length / commits.length) * 100);
  const substantive = kinds.substantive.length;

  const dates = kinds.substantive
    .map((c) => c.commit.author.date.slice(0, 10))
    .sort();

  /* who else was in it — a contribution is a share of something */
  const authors = {};
  for (const c of commits) {
    const login = c.author?.login ?? "unknown";
    authors[login] = (authors[login] ?? 0) + 1;
  }

  const reasons = [];
  if (substantive < MIN_COMMITS) {
    reasons.push(`${substantive} substantive commits, under the ${MIN_COMMITS} required`);
  }
  if (share < MIN_SHARE) {
    reasons.push(`${share}% of the commit graph, under the ${MIN_SHARE}% required`);
  }

  out.push({
    name: repo.name,
    url: repo.html_url,
    upstream: repo.parent?.full_name ?? null,
    published: reasons.length === 0,
    reasons,
    share,
    commits: { mine: mine.length, total: commits.length, substantive },
    excluded: { merges: kinds.merge.length, boilerplate: kinds.boilerplate.length },
    span: dates.length > 0 ? { from: dates[0], to: dates[dates.length - 1] } : null,
    stack: Object.entries(langs)
      .sort((a, b) => b[1] - a[1])
      .map(([name, bytes]) => ({ name, bytes })),
    authors: Object.entries(authors)
      .sort((a, b) => b[1] - a[1])
      .map(([login, count]) => ({ login, count })),
    /* the subjects, so the detail on the page is the commit graph's own words */
    work: kinds.substantive.map((c) => ({
      date: c.commit.author.date.slice(0, 10),
      subject: c.commit.message.split("\n")[0].trim(),
    })),
  });
}

out.sort((a, b) => Number(b.published) - Number(a.published) || b.share - a.share);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  `${JSON.stringify(
    {
      _note:
        "Generated by pipeline/scripts/contributions.mjs from the GitHub commit graph. Do not edit by hand. `published` is false when a contribution failed a threshold, and `reasons` says which — the rejected entries stay in the file so the filter can be audited.",
      generated: new Date().toISOString(),
      owner: OWNER,
      thresholds: { minSubstantiveCommits: MIN_COMMITS, minSharePercent: MIN_SHARE },
      mode: token ? "authenticated" : "anonymous",
      contributions: out,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

const kept = out.filter((c) => c.published);
console.log(`${out.length} shared repositories surveyed, ${kept.length} published`);
for (const c of out) {
  console.log(
    `  ${c.published ? "PUBLISH" : "reject "} ${c.name.padEnd(24)} ${String(c.share).padStart(3)}%  ` +
      `${c.commits.substantive} substantive of ${c.commits.mine} mine of ${c.commits.total}` +
      (c.published ? "" : `  — ${c.reasons.join("; ")}`),
  );
}
