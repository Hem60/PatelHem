import { readFileSync } from "node:fs";
import type { Signals } from "@meridian/engine";

/** The one place the collector JSON shape is known. */
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

export function loadSignals(path: string): { user: string; collectedAt: string; repos: Signals[] } {
  const raw = JSON.parse(readFileSync(path, "utf8")) as { user: string; collected_at: string; repos: RawRepo[] };
  return {
    user: raw.user,
    collectedAt: raw.collected_at,
    repos: raw.repos.map(r => ({
      name: r.name, description: r.description, fork: r.fork, archived: r.archived, private: r.private,
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
    })),
  };
}
