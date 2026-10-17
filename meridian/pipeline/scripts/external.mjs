/**
 * External shared work — repositories on somebody else's account.
 *
 * `contributions.mjs` surveys forks sitting on Hem60's own account. Work done
 * directly on a collaborator's repository is invisible to it: there is no
 * listing endpoint for "every repository this user has committed to", and for
 * a private repository there could not be one. So the list is written by hand
 * in `content/external.json` and this script measures what is on it.
 *
 * ── Why it is not part of the survey ────────────────────────────────────────
 * The survey workflow authenticates with `GITHUB_TOKEN`, which is scoped to
 * Hem60/PatelHem and cannot read another account's private repositories. If
 * this ran in CI it would fail every time, or worse, succeed with nothing and
 * quietly erase what was there. So it is run by hand, by someone who already
 * has access, and `data/external.json` is committed. The survey never touches
 * that file, which is what stops a run from wiping it.
 *
 * The cost is stated on the page rather than hidden: these figures were read
 * on a date, by someone with access, and a stranger cannot reproduce them.
 * Every other number on the site can be, and the difference is the whole
 * reason this is a separate file with a separate label.
 *
 * ── What is deliberately withheld ───────────────────────────────────────────
 * A private repository belongs to its owner, and publishing one is a
 * disclosure. What goes out is the least that makes the entry meaningful:
 *
 *   published   name, owner, the owner's own description, the language map,
 *               the authorship arithmetic, the date span, co-author logins
 *   withheld    commit subjects, file paths, topics, homepage
 *
 * The public cards carry commit subjects verbatim — that is the point of
 * them. Here they are the most revealing thing in the repository, so they are
 * counted and not quoted, and the card says so.
 *
 * Usage: GITHUB_TOKEN=... node scripts/external.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const LIST = join(HERE, "..", "content", "external.json");
const OUT = join(HERE, "..", "data", "external.json");

const OWNER = "Hem60";

/** Subjects that represent no authored change. Matches contributions.mjs. */
const BOILERPLATE = /^(initial commit|first commit|create readme(\.md)?|update readme(\.md)?)$/i;

const token = process.env.GITHUB_TOKEN?.trim() ?? process.env.GH_TOKEN?.trim();

async function api(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "meridian-external",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status} on ${path}`);
  return res.json();
}

/** Classify one commit: substantive, a merge, or boilerplate. */
function classify(commit) {
  if ((commit.parents?.length ?? 1) > 1) return "merge";
  const subject = (commit.commit?.message ?? "").split("\n")[0].trim();
  if (BOILERPLATE.test(subject)) return "boilerplate";
  return "substantive";
}

/** Every commit, paged — a 100-commit cap would understate a long graph. */
async function allCommits(full) {
  const out = [];
  for (let page = 1; page <= 10; page += 1) {
    const batch = await api(`/repos/${full}/commits?per_page=100&page=${page}`);
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

if (token === undefined || token === "") {
  console.error("GITHUB_TOKEN is not set. A private repository cannot be read without one.");
  console.error("Nothing was written; data/external.json is unchanged.");
  process.exit(1);
}

const list = JSON.parse(readFileSync(LIST, "utf8"));
const out = [];

for (const full of list.repos ?? []) {
  const [owner, name] = full.split("/");
  process.stdout.write(`  ${full} … `);

  let repo;
  try {
    repo = await api(`/repos/${full}`);
  } catch (err) {
    /*
     * Skip, loudly, and write nothing for it. A repository that cannot be
     * read is not a repository to guess about — and an entry that silently
     * kept last week's figures would be the stalest kind of lie.
     */
    console.log(`unreadable (${err.message}) — skipped`);
    continue;
  }

  const commits = await allCommits(full);
  const langs = await api(`/repos/${full}/languages`);

  const mine = commits.filter((c) => (c.author?.login ?? "").toLowerCase() === OWNER.toLowerCase());
  const kinds = { substantive: [], merge: [], boilerplate: [] };
  for (const c of mine) kinds[classify(c)].push(c);

  const dates = kinds.substantive.map((c) => c.commit.author.date.slice(0, 10)).sort();

  const authors = {};
  for (const c of commits) {
    const login = c.author?.login ?? "unknown";
    authors[login] = (authors[login] ?? 0) + 1;
  }

  out.push({
    name,
    owner,
    /* the owner's own sentence about it, not mine */
    description: typeof repo.description === "string" ? repo.description : null,
    private: Boolean(repo.private),
    /* a private repository has no URL a reader can open, so it carries none */
    url: repo.private ? null : repo.html_url,
    share: commits.length === 0 ? 0 : Math.round((mine.length / commits.length) * 100),
    commits: {
      mine: mine.length,
      total: commits.length,
      substantive: kinds.substantive.length,
    },
    excluded: { merges: kinds.merge.length, boilerplate: kinds.boilerplate.length },
    span: dates.length > 0 ? { from: dates[0], to: dates[dates.length - 1] } : null,
    stack: Object.entries(langs)
      .sort((a, b) => b[1] - a[1])
      .map(([n, bytes]) => ({ name: n, bytes })),
    authors: Object.entries(authors)
      .sort((a, b) => b[1] - a[1])
      .map(([login, count]) => ({ login, count })),
  });

  console.log(`${mine.length} of ${commits.length} commits mine${repo.private ? " · private" : ""}`);
}

out.sort((a, b) => b.share - a.share || a.name.localeCompare(b.name));

writeFileSync(
  OUT,
  JSON.stringify(
    {
      generated: new Date().toISOString(),
      owner: OWNER,
      /*
       * Named so the page can say it. These figures were read by someone with
       * access to repositories a visitor cannot open, which makes this the one
       * file on the site that a stranger cannot reproduce.
       */
      collectedBy: OWNER,
      external: out,
    },
    null,
    2,
  ) + "\n",
  "utf8",
);

console.log(`\n${out.length} external repositories written to data/external.json`);
