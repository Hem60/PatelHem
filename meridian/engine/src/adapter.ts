import { readFileSync } from "node:fs";
import type { Signals } from "./signals.js";

/**
 * Phase 00's collector wrote snake_case JSON straight from the GitHub API.
 * This is the only place that shape is known; everything downstream sees
 * `Signals`. When the phase 02 collector replaces it, only this file moves.
 */
interface RawRepo {
  name: string; description: string | null; fork: boolean; archived: boolean; private: boolean;
  paths?: string[]; manifests?: Record<string, string>; languages?: Record<string, number>;
  commit_count?: number; commit_dates?: string[];
  contributors?: { login: string; contributions: number }[];
  created_at: string; pushed_at: string; topics?: string[]; license: string | null;
  homepage: string | null; homepage_status: number | null; release_count?: number;
  stars?: number; forks?: number; open_issues?: number;
  readme_len?: number; readme_images?: number; last_run_conclusion: string | null;
}

export interface Catalogue {
  readonly user: string;
  readonly collectedAt: string;
  readonly repos: readonly Signals[];
}

export function toSignals(r: RawRepo): Signals {
  return {
    name: r.name, description: r.description, fork: r.fork,
    archived: r.archived, private: r.private,
    paths: r.paths ?? [], manifests: r.manifests ?? {}, languages: r.languages ?? {},
    commitCount: r.commit_count ?? 0, commitDates: r.commit_dates ?? [],
    contributors: r.contributors ?? [],
    createdAt: r.created_at, pushedAt: r.pushed_at,
    topics: r.topics ?? [], license: r.license,
    homepage: r.homepage, homepageStatus: r.homepage_status,
    releaseCount: r.release_count ?? 0,
    stars: r.stars ?? 0, forks: r.forks ?? 0, openIssues: r.open_issues ?? 0,
    readmeLength: r.readme_len ?? 0, readmeImages: r.readme_images ?? 0,
    lastRunConclusion: r.last_run_conclusion,
  };
}

export function loadCatalogue(path: string): Catalogue {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as {
    user: string; collected_at: string; repos: RawRepo[];
  };
  return {
    user: parsed.user,
    collectedAt: parsed.collected_at,
    repos: parsed.repos.map(toSignals),
  };
}
