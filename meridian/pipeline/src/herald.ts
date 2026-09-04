import type { ScoredRepo, Signals } from "@meridian/engine";
import type { Claim } from "./catalogue.js";

/**
 * Herald. No model, no generation — a fixed set of sentence templates, each
 * bound to a measured signal. A template whose evidence is missing simply
 * does not fire, so every sentence that survives is true by construction.
 *
 * Each template declares what it cites. Plumb resolves those citations
 * against the real file tree before the sentence is allowed into a card.
 */

export interface Template {
  readonly id: string;
  /** Does the evidence for this sentence exist? */
  readonly fires: (s: Signals, r: ScoredRepo) => boolean;
  /** The sentence, and the files or signals that make it true. */
  readonly render: (s: Signals, r: ScoredRepo) => Claim;
}

const plural = (n: number, one: string, many = `${one}s`): string =>
  `${n} ${n === 1 ? one : many}`;

const find = (s: Signals, re: RegExp): string | undefined => s.paths.find(p => re.test(p));
const all = (s: Signals, re: RegExp): string[] => s.paths.filter(p => re.test(p));

const months = (s: Signals): number => new Set(s.commitDates.map(d => d.slice(0, 7))).size;

/** Human-readable language list, largest first, at most three. */
const NOT_A_LANGUAGE = /^(Makefile|Dockerfile|Batchfile|Procfile|CMake|Roff)$/i;

export function topLanguages(s: Signals, limit = 3): string[] {
  return Object.entries(s.languages)
    .filter(([name]) => !NOT_A_LANGUAGE.test(name))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name]) => name);
}

const list = (items: readonly string[]): string =>
  items.length <= 1 ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

export const TEMPLATES: readonly Template[] = [
  {
    id: "tests",
    fires: s => all(s, /(^|\/)tests?\//i).length > 0,
    render: s => {
      const files = all(s, /(^|\/)tests?\/.*\.(py|ts|js|go)$/i);
      const cited = files.slice(0, 3);
      return {
        template: "tests",
        text: `${plural(files.length, "test file")} under \`tests/\`.`,
        cites: cited.length > 0 ? cited : ["tests/"],
      };
    },
  },
  {
    id: "ci",
    fires: s => Boolean(find(s, /^\.github\/workflows\/.*\.ya?ml$/i)),
    render: s => {
      const wf = find(s, /^\.github\/workflows\/.*\.ya?ml$/i)!;
      const green = s.lastRunConclusion === "success";
      return {
        template: "ci",
        text: green
          ? `Continuous integration runs on every push, green on the last run.`
          : `Continuous integration is configured.`,
        cites: [wf],
      };
    },
  },
  {
    id: "typing",
    fires: s => /strict\s*=\s*true|"strict"\s*:\s*true/i.test(Object.values(s.manifests).join("\n")),
    render: s => {
      const file = Object.keys(s.manifests)
        .find(f => /strict\s*=\s*true|"strict"\s*:\s*true/i.test(s.manifests[f] ?? "")) ?? "pyproject.toml";
      return {
        template: "typing",
        text: `Type checking is enforced in strict mode.`,
        cites: [file],
      };
    },
  },
  {
    id: "lint",
    fires: s => /\[tool\.ruff|\[flake8\]|"eslint"|\[tool\.black/i.test(Object.values(s.manifests).join("\n"))
      || Boolean(find(s, /(^|\/)(\.eslintrc|eslint\.config|ruff\.toml)/i)),
    render: s => {
      const file = find(s, /(^|\/)(\.eslintrc|eslint\.config|ruff\.toml)/i)
        ?? Object.keys(s.manifests).find(f => /\[tool\.ruff|"eslint"/i.test(s.manifests[f] ?? ""))
        ?? "pyproject.toml";
      return { template: "lint", text: `Linting is configured and part of the build.`, cites: [file] };
    },
  },
  {
    id: "container",
    fires: s => Boolean(find(s, /(^|\/)(Dockerfile|docker-compose[^/]*\.ya?ml)$/i)),
    render: s => {
      const files = all(s, /(^|\/)(Dockerfile|docker-compose[^/]*\.ya?ml)$/i);
      const composed = files.some(f => /docker-compose/i.test(f));
      return {
        template: "container",
        text: composed
          ? `Containerised, with a Compose stack for local runs.`
          : `Containerised.`,
        cites: files.slice(0, 2),
      };
    },
  },
  {
    id: "evals",
    fires: s => all(s, /(^|\/)(evals?|benchmark)\//i).length > 0,
    render: s => ({
      template: "evals",
      text: `Ships an evaluation harness, so its own behaviour is measured rather than asserted.`,
      cites: all(s, /(^|\/)(evals?|benchmark)\//i).slice(0, 2),
    }),
  },
  {
    id: "docs",
    fires: s => all(s, /^docs?\//i).length > 0,
    render: s => ({
      template: "docs",
      text: `${plural(all(s, /^docs?\//i).length, "document")} under \`docs/\`.`,
      cites: all(s, /^docs?\//i).slice(0, 2),
    }),
  },
  {
    id: "scale",
    fires: s => s.commitCount > 0,
    render: s => {
      const m = months(s);
      const span = m >= 2 ? ` across ${plural(m, "month")}` : ``;
      return {
        template: "scale",
        text: `${plural(s.commitCount, "commit")}${span}.`,
        cites: ["signal:commitCount"],
      };
    },
  },
  {
    id: "stack",
    fires: s => Object.keys(s.languages).length > 0,
    render: s => ({
      template: "stack",
      text: `Written in ${list(topLanguages(s))}.`,
      cites: ["signal:languages"],
    }),
  },
  {
    id: "deployed",
    fires: s => s.homepageStatus === 200,
    render: s => ({
      template: "deployed",
      text: `Deployed and reachable.`,
      cites: ["signal:homepageStatus"],
    }),
  },
  {
    id: "licensed",
    fires: s => s.license !== null,
    render: s => ({
      template: "licensed",
      text: `Released under ${s.license}.`,
      cites: ["signal:license"],
    }),
  },
];

/** Run every template whose evidence is present. Order is stable. */
export function compose(s: Signals, r: ScoredRepo): Claim[] {
  return TEMPLATES.filter(t => t.fires(s, r)).map(t => t.render(s, r));
}

/** The measured facts shown on a card. No prose, no interpretation. */
export function facts(s: Signals, r: ScoredRepo): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  if (s.commitCount > 0) out.push({ label: "Commits", value: String(s.commitCount) });
  const tests = all(s, /(^|\/)tests?\/.*\.(py|ts|js|go)$/i).length;
  if (tests > 0) out.push({ label: "Tests", value: String(tests) });
  if (s.lastRunConclusion) out.push({ label: "CI", value: s.lastRunConclusion });
  if (s.license) out.push({ label: "Licence", value: s.license });
  if (s.releaseCount > 0) out.push({ label: "Releases", value: String(s.releaseCount) });
  const kb = Math.round(Object.values(s.languages).reduce((a, b) => a + b, 0) / 1024);
  if (kb > 0) out.push({ label: "Code", value: `${kb} KB` });
  out.push({ label: "Score", value: r.composite.toFixed(1) });
  return out;
}
