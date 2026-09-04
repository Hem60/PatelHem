// Meridian phase 00 — the five axes.
// Deterministic. Same input always gives the same number, and every axis
// keeps the raw signals that produced it so `why <repo>` can print them.

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
// Log-scaled contribution: `full` marks the value that earns all `points`.
const log = (v, full, points) =>
  v <= 0 ? 0 : points * Math.min(1, Math.log10(1 + v) / Math.log10(1 + full));

const any = (paths, re) => paths.some(p => re.test(p));
const count = (paths, re) => paths.filter(p => re.test(p)).length;

export const WEIGHTS = { stability: .28, mass: .24, anomaly: .20, luminosity: .16, cadence: .12 };
export const THRESHOLDS = { MYTHIC: 88, LEGENDARY: 76, EPIC: 64, RARE: 50, UNCOMMON: 34 };

export function classify(score, t = THRESHOLDS) {
  if (score >= t.MYTHIC) return "MYTHIC";
  if (score >= t.LEGENDARY) return "LEGENDARY";
  if (score >= t.EPIC) return "EPIC";
  if (score >= t.RARE) return "RARE";
  if (score >= t.UNCOMMON) return "UNCOMMON";
  return "COMMON";
}

const RE = {
  test: /(^|\/)(tests?|__tests__|spec)\//i,
  testFile: /(test_[^/]+\.py|[^/]+_test\.(py|go|ts|js)|[^/]+\.(test|spec)\.(ts|tsx|js|jsx|py)$)/i,
  ci: /^\.github\/workflows\/[^/]+\.ya?ml$/i,
  lint: /(^|\/)(\.eslintrc|eslint\.config|ruff\.toml|\.flake8|\.pylintrc|biome\.json)/i,
  types: /(^|\/)(tsconfig\.json|mypy\.ini|py\.typed|\.mypy\.ini)$/i,
  lock: /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|poetry\.lock|uv\.lock|requirements\.txt|Pipfile\.lock)$/i,
  cov: /(coverage|\.coveragerc|codecov|pytest\.ini|setup\.cfg|jest\.config|vitest\.config)/i,
  docker: /(^|\/)(Dockerfile|docker-compose[^/]*\.ya?ml)$/i,
  docs: /^docs?\//i,
  license: /^LICEN[CS]E/i,
  manifest: /(^|\/)(package\.json|pyproject\.toml|setup\.py|Cargo\.toml|go\.mod)$/i,
  eval: /(^|\/)(evals?|benchmark|bench)\//i,
};

// Domains that are over-represented in student portfolios. Being one of
// these is not a flaw, but it is not distinctive either.
const COMMON_DOMAIN = /(todo|portfolio|movie|iris|titanic|weather|calculator|blog|clone|tutorial|boilerplate|starter|quiz|notes?app|url.?short)/i;
const RARE_DOMAIN = /(chargeback|adjudicat|verification|attestation|settlement|compliance|surveillance|fraud|delegation|on.?chain|policy.?as.?code|audit.?trail|eval.?harness|agentic|red.?team|threat.?model|provenance|zero.?knowledge)/i;

export function score(r, ctx = {}) {
  const p = r.paths || [];
  const now = ctx.now ? new Date(ctx.now) : new Date();
  const days = d => (now - new Date(d)) / 86400000;
  const S = {};

  // ---- STABILITY — does it hold together? -------------------------------
  const testFiles = count(p, RE.testFile) + count(p, RE.test);
  const hasCI = any(p, RE.ci);
  const ciGreen = r.last_run_conclusion === "success";
  // Config increasingly lives inside the manifest, not in dotfiles.
  const mf = Object.values(r.manifests || {}).join("\n");
  const inMf = re => re.test(mf);
  const hasCov = any(p, RE.cov) || inMf(/\[tool\.pytest|\[tool\.coverage|"(jest|vitest)"\s*:|addopts/i);
  const hasLint = any(p, RE.lint) || inMf(/\[tool\.ruff|\[flake8\]|"eslint"|\[tool\.black|\[tool\.pylint/i);
  const hasTypes = any(p, RE.types) || inMf(/\[tool\.mypy|"typescript"|\[tool\.pyright/i);
  const strict = inMf(/strict\s*=\s*true|"strict"\s*:\s*true/i);
  const st = {
    tests: testFiles > 0 ? log(testFiles, 40, 26) : 0,
    ci: hasCI ? 18 : 0,
    ci_green: hasCI && ciGreen ? 12 : 0,
    coverage: hasCov ? 10 : 0,
    lint: hasLint ? 10 : 0,
    typing: hasTypes ? (strict ? 8 : 5) : 0,
    license: r.license ? 8 : 0,
    pinned: any(p, RE.lock) || inMf(/\[project\]|dependencies/i) ? 8 : 0,
  };
  S.stability = { value: clamp(Object.values(st).reduce((a, b) => a + b, 0)), parts: st,
    evidence: { test_files: testFiles, ci_workflow: hasCI, last_run: r.last_run_conclusion, license: r.license, lint: hasLint, types: hasTypes, strict, coverage_cfg: hasCov } };

  // ---- MASS — how much is actually there? -------------------------------
  const langs = Object.values(r.languages || {});
  const bytes = langs.reduce((a, b) => a + b, 0);
  const lifespan = Math.max(0, days(r.created_at) - days(r.pushed_at));
  const modules = count(p, RE.manifest);
  const ma = {
    commits: log(r.commit_count, 250, 32),
    code: log(bytes / 1024, 900, 22),
    modules: log(modules, 6, 16),
    lifespan: log(lifespan, 500, 20),
    languages: log(Object.keys(r.languages || {}).length, 6, 10),
  };
  S.mass = { value: clamp(Object.values(ma).reduce((a, b) => a + b, 0)), parts: ma,
    evidence: { commits: r.commit_count, code_kb: Math.round(bytes / 1024), modules, lifespan_days: Math.round(lifespan) } };

  // ---- ANOMALY — how unusual is it? -------------------------------------
  const text = [r.name, r.description || "", (r.topics || []).join(" ")].join(" ");
  let an = 50;
  const hitsRare = RARE_DOMAIN.test(text), hitsCommon = COMMON_DOMAIN.test(text);
  if (hitsRare) an += 22;
  if (hitsCommon) an -= 20;
  if (any(p, RE.eval)) an += 8;               // it evaluates itself
  if (any(p, /\.sol$/)) an += 6;              // on-chain
  const uncommonLangs = Object.keys(r.languages || {})
    .filter(l => /Rust|Solidity|Go|Kotlin|Haskell|Elixir|Zig|OCaml/i.test(l)).length;
  an += Math.min(8, uncommonLangs * 4);
  // Distinctness inside your own catalogue: repeating a stack is less novel.
  if (ctx.langCounts && r.language) {
    const shared = ctx.langCounts[r.language] || 1;
    if (shared > 2) an -= 6;
  }
  S.anomaly = { value: clamp(an), parts: { base: 50, rare_domain: hitsRare ? 22 : 0, common_domain: hitsCommon ? -20 : 0 },
    evidence: { rare_domain: hitsRare, common_domain: hitsCommon, uncommon_langs: uncommonLangs } };

  // ---- LUMINOSITY — can anyone else see it? -----------------------------
  const lu = {
    deployed: r.homepage_status === 200 ? 30 : (r.homepage ? 8 : 0),
    readme: log(r.readme_len, 8000, 22),
    images: r.readme_images > 0 ? 8 : 0,
    description: r.description ? 10 : 0,
    topics: (r.topics || []).length > 0 ? 10 : 0,
    releases: r.release_count > 0 ? 10 : 0,
    docs: any(p, RE.docs) ? 5 : 0,
    social: Math.min(5, (r.stars || 0) * 2 + (r.forks || 0)),
  };
  S.luminosity = { value: clamp(Object.values(lu).reduce((a, b) => a + b, 0)), parts: lu,
    evidence: { homepage: r.homepage, status: r.homepage_status, readme_len: r.readme_len, topics: (r.topics || []).length, releases: r.release_count } };

  // ---- CADENCE — is it alive? -------------------------------------------
  const dates = (r.commit_dates || []).map(d => new Date(d)).sort((a, b) => a - b);
  const activeDays = new Set(dates.map(d => d.toISOString().slice(0, 10))).size;
  const activeMonths = new Set(dates.map(d => d.toISOString().slice(0, 7))).size;
  const sinceLast = days(r.pushed_at);
  const recency = sinceLast <= 7 ? 30 : sinceLast <= 30 ? 24 : sinceLast <= 90 ? 15 : sinceLast <= 365 ? 7 : 0;
  const ca = {
    recency,
    spread_days: log(activeDays, 40, 26),
    spread_months: log(activeMonths, 10, 24),
    activity: Math.min(10, (r.open_issues || 0) * 2),
    sustained: activeMonths >= 2 ? 10 : 0,     // more than a single burst
  };
  S.cadence = { value: clamp(Object.values(ca).reduce((a, b) => a + b, 0)), parts: ca,
    evidence: { days_since_push: Math.round(sinceLast), active_days: activeDays, active_months: activeMonths } };

  const composite = Object.entries(WEIGHTS)
    .reduce((a, [k, w]) => a + S[k].value * w, 0);

  // Authorship share, for the attribution strand.
  const total = (r.contributors || []).reduce((a, c) => a + c.contributions, 0);
  const mine = (r.contributors || []).find(c => c.login?.toLowerCase() === (ctx.user || "").toLowerCase());
  const share = total ? (mine?.contributions || 0) / total : null;

  return {
    name: r.name, fork: r.fork, private: r.private,
    axes: S,
    composite: Math.round(composite * 10) / 10,
    class: classify(composite),
    authorship: { mine: mine?.contributions || 0, total, share: share === null ? null : Math.round(share * 100) },
  };
}
