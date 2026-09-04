import type { Axis, ScoreContext, Signals } from "./signals.js";

/**
 * What each component of each axis is worth at its best.
 *
 * One definition, used by the scoring below and published in the catalogue so
 * the site can show "8 of 8" without re-stating any of these numbers. They
 * were literals inline in the expressions; a second copy anywhere else would
 * have drifted the first time a weight was tuned.
 *
 * Two components are penalties and their "max" is the size of the penalty:
 * `commonDomain` and `repeatedStack` only ever subtract.
 */
export const PART_MAX = {
  stability: { tests: 26, ci: 18, ciGreen: 12, coverage: 10, lint: 10, typing: 8, license: 8, pinned: 8 },
  mass: { commits: 32, code: 22, modules: 16, lifespan: 20, languages: 10 },
  anomaly: { base: 50, rareDomain: 22, commonDomain: -20, evaluates: 8, onChain: 6, uncommonLanguages: 8, repeatedStack: -6 },
  luminosity: { deployed: 30, readme: 22, images: 8, description: 10, topics: 10, releases: 10, docs: 5, social: 5 },
  cadence: { recency: 30, activeDays: 26, activeMonths: 24, issueActivity: 10, sustained: 10 },
} as const;


export const clamp = (n: number, lo = 0, hi = 100): number => Math.max(lo, Math.min(hi, n));

/**
 * Log-scaled contribution. `full` is the value that earns all of `points`;
 * growth beyond it is worth progressively less. Used everywhere a raw count
 * would otherwise let one enormous number dominate an axis.
 */
export const log = (value: number, full: number, points: number): number =>
  value <= 0 ? 0 : points * Math.min(1, Math.log10(1 + value) / Math.log10(1 + full));

const sum = (o: Record<string, number>): number => Object.values(o).reduce((a, b) => a + b, 0);
const any = (paths: readonly string[], re: RegExp): boolean => paths.some(p => re.test(p));
const count = (paths: readonly string[], re: RegExp): number => paths.filter(p => re.test(p)).length;

export const PATTERNS = {
  testDir: /(^|\/)(tests?|__tests__|spec)\//i,
  testFile: /(test_[^/]+\.py|[^/]+_test\.(py|go|ts|js)|[^/]+\.(test|spec)\.(ts|tsx|js|jsx|py)$)/i,
  ci: /^\.github\/workflows\/[^/]+\.ya?ml$/i,
  lintFile: /(^|\/)(\.eslintrc|eslint\.config|ruff\.toml|\.flake8|\.pylintrc|biome\.json)/i,
  typeFile: /(^|\/)(tsconfig\.json|mypy\.ini|py\.typed|\.mypy\.ini)$/i,
  lockFile: /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|poetry\.lock|uv\.lock|requirements\.txt|Pipfile\.lock)$/i,
  covFile: /(coverage|\.coveragerc|codecov|pytest\.ini|jest\.config|vitest\.config)/i,
  docs: /^docs?\//i,
  manifest: /(^|\/)(package\.json|pyproject\.toml|setup\.py|Cargo\.toml|go\.mod)$/i,
  evals: /(^|\/)(evals?|benchmark|bench)\//i,
  solidity: /\.sol$/,
} as const;

/** Config increasingly lives inside the manifest rather than in dotfiles. */
export const MANIFEST_PATTERNS = {
  coverage: /\[tool\.pytest|\[tool\.coverage|"(jest|vitest)"\s*:|addopts/i,
  lint: /\[tool\.ruff|\[flake8\]|"eslint"|\[tool\.black|\[tool\.pylint/i,
  types: /\[tool\.mypy|"typescript"|\[tool\.pyright/i,
  strict: /strict\s*=\s*true|"strict"\s*:\s*true/i,
  deps: /\[project\]|dependencies/i,
} as const;

/** Domains over-represented in student portfolios. Common, not bad. */
export const COMMON_DOMAIN =
  /(todo|portfolio|movie|iris|titanic|weather|calculator|blog|clone|tutorial|boilerplate|starter|quiz|notes?app|url.?short)/i;
/** Domains that are genuinely uncommon to attempt. */
export const RARE_DOMAIN =
  /(chargeback|adjudicat|verification|attestation|settlement|compliance|surveillance|fraud|delegation|on.?chain|policy.?as.?code|audit.?trail|eval(uation)?.?harness|agentic|red.?team|threat.?model|provenance|zero.?knowledge|retrieval.?augmented)/i;

const daysBetween = (a: string, b: string): number =>
  (Date.parse(a) - Date.parse(b)) / 86_400_000;

/** Does it hold together? Weighted heaviest — correctness outranks size. */
export function stability(s: Signals): Axis {
  const testFiles = count(s.paths, PATTERNS.testFile) + count(s.paths, PATTERNS.testDir);
  const hasCI = any(s.paths, PATTERNS.ci);
  const manifestText = Object.values(s.manifests).join("\n");
  const inManifest = (re: RegExp): boolean => re.test(manifestText);

  const hasCoverage = any(s.paths, PATTERNS.covFile) || inManifest(MANIFEST_PATTERNS.coverage);
  const hasLint = any(s.paths, PATTERNS.lintFile) || inManifest(MANIFEST_PATTERNS.lint);
  const hasTypes = any(s.paths, PATTERNS.typeFile) || inManifest(MANIFEST_PATTERNS.types);
  const isStrict = inManifest(MANIFEST_PATTERNS.strict);

  const parts = {
    tests: testFiles > 0 ? log(testFiles, 40, PART_MAX.stability.tests) : 0,
    ci: hasCI ? PART_MAX.stability.ci : 0,
    ciGreen: hasCI && s.lastRunConclusion === "success" ? PART_MAX.stability.ciGreen : 0,
    coverage: hasCoverage ? PART_MAX.stability.coverage : 0,
    lint: hasLint ? PART_MAX.stability.lint : 0,
    typing: hasTypes ? (isStrict ? PART_MAX.stability.typing : 5) : 0,
    license: s.license ? PART_MAX.stability.license : 0,
    pinned: any(s.paths, PATTERNS.lockFile) || inManifest(MANIFEST_PATTERNS.deps) ? PART_MAX.stability.pinned : 0,
  };
  return {
    value: clamp(sum(parts)), parts,
    evidence: {
      testFiles, ciWorkflow: hasCI, lastRun: s.lastRunConclusion,
      license: s.license, lint: hasLint, types: hasTypes, strict: isStrict, coverage: hasCoverage,
    },
  };
}

/** How much is actually there? */
export function mass(s: Signals, ctx: ScoreContext): Axis {
  const bytes = Object.values(s.languages).reduce((a, b) => a + b, 0);
  const lifespanDays = Math.max(0, daysBetween(s.pushedAt, s.createdAt));
  const modules = count(s.paths, PATTERNS.manifest);
  const parts = {
    commits: log(s.commitCount, 250, PART_MAX.mass.commits),
    code: log(bytes / 1024, 900, PART_MAX.mass.code),
    modules: log(modules, 6, PART_MAX.mass.modules),
    lifespan: log(lifespanDays, 500, PART_MAX.mass.lifespan),
    languages: log(Object.keys(s.languages).length, 6, PART_MAX.mass.languages),
  };
  void ctx;
  return {
    value: clamp(sum(parts)), parts,
    evidence: { commits: s.commitCount, codeKb: Math.round(bytes / 1024), modules, lifespanDays: Math.round(lifespanDays) },
  };
}

/** How unusual is it? Bounded rule-based adjustment around a neutral 50. */
export function anomaly(s: Signals, ctx: ScoreContext): Axis {
  const text = [s.name, s.description ?? "", s.topics.join(" ")].join(" ");
  const hitsRare = RARE_DOMAIN.test(text);
  const hitsCommon = COMMON_DOMAIN.test(text);
  const uncommonLangs = Object.keys(s.languages)
    .filter(l => /Rust|Solidity|Go|Kotlin|Haskell|Elixir|Zig|OCaml/i.test(l)).length;

  const primary = Object.keys(s.languages)[0];
  const shared = primary ? (ctx.languageCounts[primary] ?? 1) : 1;

  const parts = {
    base: PART_MAX.anomaly.base,
    rareDomain: hitsRare ? PART_MAX.anomaly.rareDomain : 0,
    commonDomain: hitsCommon ? PART_MAX.anomaly.commonDomain : 0,
    evaluates: any(s.paths, PATTERNS.evals) ? PART_MAX.anomaly.evaluates : 0,
    onChain: any(s.paths, PATTERNS.solidity) ? PART_MAX.anomaly.onChain : 0,
    uncommonLanguages: Math.min(PART_MAX.anomaly.uncommonLanguages, uncommonLangs * 4),
    repeatedStack: shared > 2 ? PART_MAX.anomaly.repeatedStack : 0,
  };
  return {
    value: clamp(sum(parts)), parts,
    evidence: { rareDomain: hitsRare, commonDomain: hitsCommon, uncommonLangs, stackSharedBy: shared },
  };
}

/** Can anyone else see it? Stars sit here, capped, and can never carry a repo. */
export function luminosity(s: Signals): Axis {
  const parts = {
    deployed: s.homepageStatus === 200 ? PART_MAX.luminosity.deployed : (s.homepage ? 8 : 0),
    readme: log(s.readmeLength, 8000, PART_MAX.luminosity.readme),
    images: s.readmeImages > 0 ? PART_MAX.luminosity.images : 0,
    description: s.description ? PART_MAX.luminosity.description : 0,
    topics: s.topics.length > 0 ? PART_MAX.luminosity.topics : 0,
    releases: s.releaseCount > 0 ? PART_MAX.luminosity.releases : 0,
    docs: any(s.paths, PATTERNS.docs) ? PART_MAX.luminosity.docs : 0,
    social: Math.min(PART_MAX.luminosity.social, s.stars * 2 + s.forks),
  };
  return {
    value: clamp(sum(parts)), parts,
    evidence: {
      homepage: s.homepage, homepageStatus: s.homepageStatus,
      readmeLength: s.readmeLength, topics: s.topics.length, releases: s.releaseCount,
    },
  };
}

/** Is it alive? Sustained work beats a single weekend. */
export function cadence(s: Signals, ctx: ScoreContext): Axis {
  const days = new Set(s.commitDates.map(d => d.slice(0, 10)));
  const months = new Set(s.commitDates.map(d => d.slice(0, 7)));
  const sinceLastPush = daysBetween(ctx.now, s.pushedAt);

  const recency =
    sinceLastPush <= 7 ? PART_MAX.cadence.recency : sinceLastPush <= 30 ? 24 :
    sinceLastPush <= 90 ? 15 : sinceLastPush <= 365 ? 7 : 0;

  const parts = {
    recency,
    activeDays: log(days.size, 40, PART_MAX.cadence.activeDays),
    activeMonths: log(months.size, 10, PART_MAX.cadence.activeMonths),
    issueActivity: Math.min(PART_MAX.cadence.issueActivity, s.openIssues * 2),
    sustained: months.size >= 2 ? PART_MAX.cadence.sustained : 0,
  };
  return {
    value: clamp(sum(parts)), parts,
    evidence: { daysSincePush: Math.round(sinceLastPush), activeDays: days.size, activeMonths: months.size },
  };
}
