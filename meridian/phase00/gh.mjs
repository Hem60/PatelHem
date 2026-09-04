// Authenticated, disk-cached GitHub reads. Auth comes from `gh`.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const HERE = dirname(fileURLToPath(import.meta.url));
export const CACHE = join(HERE, "cache");
export const OUT = join(HERE, "out");
mkdirSync(CACHE, { recursive: true });
mkdirSync(OUT, { recursive: true });

const key = p => p.replace(/[^a-z0-9]+/gi, "_").slice(0, 120) + ".json";

export function api(path, { headers = false } = {}) {
  const f = join(CACHE, (headers ? "H_" : "") + key(path));
  if (existsSync(f)) return JSON.parse(readFileSync(f, "utf8"));
  const args = ["api", path];
  if (headers) args.push("--include");
  let out;
  try {
    out = execFileSync("gh", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
  } catch (e) {
    const val = { __error: true, status: e.status ?? null };
    writeFileSync(f, JSON.stringify(val)); return val;
  }
  let val;
  if (headers) {
    let i = out.indexOf("\r\n\r\n"); if (i < 0) i = out.indexOf("\n\n");
    const body = out.slice(i).trim();
    val = { headers: out.slice(0, i), body: body ? JSON.parse(body) : null };
  } else val = JSON.parse(out);
  writeFileSync(f, JSON.stringify(val));
  return val;
}

const lastPage = r => {
  if (r.__error || !r.headers) return null;
  const m = r.headers.match(/[?&]page=(\d+)>;\s*rel="last"/);
  return m ? Number(m[1]) : null;
};

export function countVia(full, path) {
  const r = api(`repos/${full}/${path}`, { headers: true });
  return lastPage(r) ?? (Array.isArray(r.body) ? r.body.length : 0);
}

async function liveUrl(url) {
  if (!url) return null;
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 8000);
    const res = await fetch(url, { redirect: "follow", signal: c.signal });
    clearTimeout(t); return res.status;
  } catch { return null; }
}

export async function collectRepo(r) {
  const full = r.full_name;
  const tree = api(`repos/${full}/git/trees/${r.default_branch || "main"}?recursive=1`);
  const paths = Array.isArray(tree?.tree) ? tree.tree.map(t => t.path) : [];
  const languages = api(`repos/${full}/languages`);
  const contributors = api(`repos/${full}/contributors?per_page=100`);
  const commits = api(`repos/${full}/commits?per_page=100`);
  const runs = api(`repos/${full}/actions/runs?per_page=10`);
  let readme = "";
  const rd = api(`repos/${full}/readme`);
  if (!rd.__error && rd.content) readme = Buffer.from(rd.content, "base64").toString("utf8");

  // Modern projects keep test, lint and type config inside the manifest
  // rather than in standalone dotfiles. Reading the file is the difference
  // between scoring the layout and scoring the project.
  const manifests = {};
  for (const mf of ["pyproject.toml", "package.json", "setup.cfg", "tox.ini", "Cargo.toml", "go.mod"]) {
    if (!paths.includes(mf)) continue;
    const c = api(`repos/${full}/contents/${mf}`);
    if (!c.__error && c.content) manifests[mf] = Buffer.from(c.content, "base64").toString("utf8");
  }

  return {
    name: r.name, full_name: full, description: r.description,
    fork: r.fork, archived: r.archived, private: r.private,
    language: r.language, languages: languages.__error ? {} : languages,
    size_kb: r.size, stars: r.stargazers_count, forks: r.forks_count,
    open_issues: r.open_issues_count, topics: r.topics || [],
    license: r.license ? r.license.spdx_id : null,
    homepage: r.homepage || null, homepage_status: await liveUrl(r.homepage),
    created_at: r.created_at, pushed_at: r.pushed_at,
    default_branch: r.default_branch, tree_truncated: tree?.truncated ?? false,
    paths, path_count: paths.length,
    commit_count: countVia(full, "commits?per_page=1"),
    release_count: countVia(full, "releases?per_page=1"),
    commit_dates: Array.isArray(commits) ? commits.map(c => c.commit?.author?.date).filter(Boolean) : [],
    contributors: Array.isArray(contributors) ? contributors.map(c => ({ login: c.login, contributions: c.contributions })) : [],
    last_run_conclusion: runs?.workflow_runs?.[0]?.conclusion ?? null,
    manifests,
    readme_len: readme.length,
    readme_images: (readme.match(/!\[[^\]]*\]\(|<img\s/gi) || []).length,
  };
}
