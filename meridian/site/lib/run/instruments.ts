/**
 * The observing run.
 *
 * Five instruments, dispatched against one repository. Two of them do network
 * work and three of them are pure functions, and the panel says which is
 * which rather than dressing all five up as activity:
 *
 *   Almanac   retrieves history, contributors, releases and the last CI run
 *   Prism     reads the file tree, the language map and the manifests
 *   Sextant   scores — the engine, unchanged, no I/O and no clock of its own
 *   Herald    writes the entry from templates bound to measured signals
 *   Plumb     verifies every clause Herald wrote against a path that resolves
 *
 * Almanac and Prism run their calls concurrently and the results settle out of
 * order because the network genuinely is concurrent — nothing here staggers
 * anything for effect. Sextant, Herald and Plumb are the same code the
 * pipeline runs, imported rather than reimplemented, so what the console
 * computes is what the catalogue would publish.
 *
 * No language model is involved at any point.
 */
import { score, type ScoreContext, type Signals } from "@meridian/engine";
import { compose as heraldCompose, facts as heraldFacts, topLanguages } from "@meridian/pipeline/dist/herald.js";
import { verify } from "@meridian/pipeline/dist/plumb.js";
import { Session, rateLimited, type CallRecord } from "./github";
import { ESTIMATED_CALLS } from "./plan";

/**
 * What to say when the budget is gone.
 *
 * The old line stated the ceiling and stopped, which is honest but leaves a
 * reader stuck: it never said when the window reopens or how to raise it. Both
 * facts are already in hand — GitHub returns the reset timestamp on every
 * response, and the session knows whether it is authenticated.
 *
 * Still no faking. This only makes the refusal useful.
 */
function rateLimitMessage(session: Session): string {
  const limit = session.rateLimit?.limit ?? 60;
  const reset = session.rateLimit?.reset;
  const mins =
    reset === undefined ? null : Math.max(1, Math.ceil((reset * 1000 - Date.now()) / 60000));

  const when = mins === null ? "" : ` The window reopens in about ${mins} minute${mins === 1 ? "" : "s"}.`;
  const raise =
    session.mode === "anonymous"
      ? " A read-only GITHUB_TOKEN in .env.local raises the ceiling from 60 an hour to 5,000."
      : "";

  return `The GitHub API rate limit is spent — ${limit} an hour on this ${session.mode} connection, and it is used up.${when} Nothing was faked to cover it, so the run stops here.${raise}`;
}

export type RunEvent =
  | {
      t: "start";
      repo: string;
      owner: string;
      mode: "authenticated" | "anonymous";
      estimatedCalls: number;
      now: string;
    }
  | { t: "dispatch"; instrument: string; request: string }
  | {
      t: "receive";
      instrument: string;
      request: string;
      status: number;
      ms: number;
      cached: boolean;
      summary: string;
    }
  | { t: "note"; instrument: string; text: string }
  | {
      t: "meter";
      calls: number;
      network: number;
      cacheHits: number;
      elapsed: number;
      rateRemaining: number | null;
      rateLimit: number | null;
    }
  | {
      t: "done";
      repo: string;
      composite: number;
      classification: string;
      axes: Record<string, number>;
      upheld: string[];
      rejected: { text: string; rejection: string }[];
      facts: { label: string; value: string }[];
      stack: string[];
      elapsed: number;
      calls: number;
      network: number;
      cacheHits: number;
      now: string;
    }
  | { t: "error"; message: string };

export { ESTIMATED_CALLS, INSTRUMENT_IDS } from "./plan";

interface RepoMeta {
  name: string;
  full_name: string;
  description: string | null;
  fork: boolean;
  archived: boolean;
  private: boolean;
  default_branch: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  topics?: string[];
  license: { spdx_id: string } | null;
  homepage: string | null;
  created_at: string;
  pushed_at: string;
  size: number;
}

const MANIFESTS = ["pyproject.toml", "package.json", "setup.cfg", "tox.ini", "Cargo.toml", "go.mod"];

const decodeBase64 = (content: string): string => Buffer.from(content, "base64").toString("utf8");

const shorten = (path: string): string => (path.length > 58 ? `${path.slice(0, 55)}…` : path);

/**
 * Runs the survey and yields events as they happen.
 *
 * An async generator rather than a callback bag, because the route wants to
 * stream each event the moment it exists and backpressure should belong to
 * the consumer.
 */
export async function* observingRun(
  owner: string,
  repo: string,
  languageCounts: Record<string, number>,
): AsyncGenerator<RunEvent> {
  const session = new Session();
  const now = new Date().toISOString();
  const full = `${owner}/${repo}`;

  yield {
    t: "start",
    repo,
    owner,
    mode: session.mode,
    estimatedCalls: ESTIMATED_CALLS,
    now,
  };

  const meter = (): RunEvent => ({
    t: "meter",
    calls: session.calls.length,
    network: session.networkCalls,
    cacheHits: session.cacheHits,
    elapsed: session.elapsed,
    rateRemaining: session.rateLimit?.remaining ?? null,
    rateLimit: session.rateLimit?.limit ?? null,
  });

  const received = (
    instrument: string,
    request: string,
    record: CallRecord,
    summary: string,
  ): RunEvent => ({
    t: "receive",
    instrument,
    request,
    status: record.status,
    ms: record.ms,
    cached: record.cached,
    summary,
  });

  /* ── Almanac: the metadata read that everything else is keyed to ─────── */
  yield { t: "dispatch", instrument: "almanac", request: `GET /repos/${full}` };
  const metaPath = `repos/${full}`;
  const { data: meta, record: metaRecord } = await session.get<RepoMeta>(metaPath, {
    cacheable: false,
  });
  yield received(
    "almanac",
    `GET /repos/${full}`,
    metaRecord,
    meta ? `${meta.default_branch} · pushed ${meta.pushed_at.slice(0, 10)}` : `status ${metaRecord.status}`,
  );
  yield meter();

  if (!meta) {
    yield {
      t: "error",
      message: rateLimited(session)
        ? rateLimitMessage(session)
        : `GitHub answered ${metaRecord.status} for ${full}. No entry can be composed without the metadata read.`,
    };
    return;
  }

  yield {
    t: "note",
    instrument: "almanac",
    text: `${full} is on ${meta.default_branch}, last pushed ${meta.pushed_at.slice(0, 10)}. Everything below is keyed to that head, so a cached read is only reused while the repository has not moved.`,
  };

  /* the head SHA scopes every cache key from here on */
  yield { t: "dispatch", instrument: "prism", request: `GET /repos/${full}/commits?per_page=1` };
  const { data: headCommits, record: headRecord } = await session.get<{ sha: string }[]>(
    `repos/${full}/commits?per_page=1`,
    { cacheable: false },
  );
  const sha = headCommits?.[0]?.sha ?? null;
  yield received(
    "prism",
    `GET /repos/${full}/commits?per_page=1`,
    headRecord,
    sha ? `head ${sha.slice(0, 7)}` : `status ${headRecord.status}`,
  );
  yield meter();

  /* ── the concurrent burst. These settle in whatever order the network
        returns them, which is the point of showing it at all. ──────────── */
  let treePaths: string[] = [];
  let languages: Record<string, number> = {};
  let readme = "";
  let commitDates: string[] = [];
  let contributors: { login: string; contributions: number }[] = [];
  let releaseCount = 0;
  let lastRunConclusion: string | null = null;

  const jobs: {
    instrument: string;
    request: string;
    run: () => Promise<{ summary: string; record: CallRecord }>;
  }[] = [
    {
      instrument: "prism",
      request: `GET /repos/${full}/git/trees/${meta.default_branch}?recursive=1`,
      run: async () => {
        const r = await session.get<{ tree?: { path: string }[]; truncated?: boolean }>(
          `repos/${full}/git/trees/${meta.default_branch}?recursive=1`,
          { sha },
        );
        treePaths = (r.data?.tree ?? []).map((t) => t.path);
        return { summary: `${treePaths.length} paths`, record: r.record };
      },
    },
    {
      instrument: "prism",
      request: `GET /repos/${full}/languages`,
      run: async () => {
        const r = await session.get<Record<string, number>>(`repos/${full}/languages`, { sha });
        languages = r.data ?? {};
        return { summary: Object.keys(languages).slice(0, 3).join(", ") || "none", record: r.record };
      },
    },
    {
      instrument: "prism",
      request: `GET /repos/${full}/readme`,
      run: async () => {
        const r = await session.get<{ content?: string }>(`repos/${full}/readme`, { sha });
        readme = r.data?.content ? decodeBase64(r.data.content) : "";
        return { summary: `${readme.length} chars`, record: r.record };
      },
    },
    {
      instrument: "almanac",
      request: `GET /repos/${full}/commits?per_page=100`,
      run: async () => {
        const r = await session.get<{ commit?: { author?: { date?: string } } }[]>(
          `repos/${full}/commits?per_page=100`,
          { sha },
        );
        commitDates = (r.data ?? [])
          .map((c) => c.commit?.author?.date)
          .filter((d): d is string => typeof d === "string");
        return { summary: `${commitDates.length} commits`, record: r.record };
      },
    },
    {
      instrument: "almanac",
      request: `GET /repos/${full}/contributors?per_page=100`,
      run: async () => {
        const r = await session.get<{ login: string; contributions: number }[]>(
          `repos/${full}/contributors?per_page=100`,
          { sha },
        );
        contributors = r.data ?? [];
        return { summary: `${contributors.length} contributors`, record: r.record };
      },
    },
    {
      instrument: "almanac",
      request: `GET /repos/${full}/releases?per_page=100`,
      run: async () => {
        const r = await session.get<unknown[]>(`repos/${full}/releases?per_page=100`, { sha });
        releaseCount = Array.isArray(r.data) ? r.data.length : 0;
        return { summary: `${releaseCount} releases`, record: r.record };
      },
    },
    {
      instrument: "almanac",
      request: `GET /repos/${full}/actions/runs?per_page=1`,
      run: async () => {
        const r = await session.get<{ workflow_runs?: { conclusion: string | null }[] }>(
          `repos/${full}/actions/runs?per_page=1`,
          { sha },
        );
        lastRunConclusion = r.data?.workflow_runs?.[0]?.conclusion ?? null;
        return { summary: lastRunConclusion ?? "no runs", record: r.record };
      },
    },
  ];

  for (const job of jobs) yield { t: "dispatch", instrument: job.instrument, request: job.request };

  /* settle as they arrive: whichever finishes first is reported first */
  const pending = new Map(
    jobs.map((job, i) => [i, job.run().then((r) => ({ i, job, ...r }))] as const),
  );
  while (pending.size > 0) {
    const settled = await Promise.race(pending.values());
    pending.delete(settled.i);
    yield received(settled.job.instrument, settled.job.request, settled.record, settled.summary);
    yield meter();
  }

  /* manifests: unknown until the tree lands, so they are a second wave */
  const manifests: Record<string, string> = {};
  const present = MANIFESTS.filter((m) => treePaths.includes(m));
  if (present.length > 0) {
    for (const m of present) {
      yield { t: "dispatch", instrument: "prism", request: `GET /repos/${full}/contents/${m}` };
    }
    const contents = await Promise.all(
      present.map(async (m) => {
        const r = await session.get<{ content?: string }>(`repos/${full}/contents/${m}`, { sha });
        if (r.data?.content) manifests[m] = decodeBase64(r.data.content);
        return { m, record: r.record };
      }),
    );
    for (const c of contents) {
      yield received(
        "prism",
        `GET /repos/${full}/contents/${shorten(c.m)}`,
        c.record,
        manifests[c.m] ? `${manifests[c.m]!.length} chars` : "unreadable",
      );
    }
    yield meter();
    yield {
      t: "note",
      instrument: "prism",
      text: `Read ${present.join(", ")} rather than only looking for standalone dotfiles. Test, lint and type configuration lives inside modern manifests, and reading the file is the difference between scoring the layout and scoring the project.`,
    };
  } else {
    yield {
      t: "note",
      instrument: "prism",
      text: `No manifest in the tree to read. Stability will score on what is actually committed, which for this repository is not much.`,
    };
  }

  /* ── Sextant: pure. No network, no clock of its own. ─────────────────── */
  const signals: Signals = {
    name: meta.name,
    description: meta.description,
    fork: meta.fork,
    archived: meta.archived,
    private: meta.private,
    paths: treePaths,
    manifests,
    languages,
    commitCount: commitDates.length,
    commitDates,
    contributors,
    createdAt: meta.created_at,
    pushedAt: meta.pushed_at,
    topics: meta.topics ?? [],
    license: meta.license?.spdx_id ?? null,
    homepage: meta.homepage,
    homepageStatus: null,
    releaseCount,
    stars: meta.stargazers_count,
    forks: meta.forks_count,
    openIssues: meta.open_issues_count,
    readmeLength: readme.length,
    readmeImages: (readme.match(/!\[[^\]]*\]\(|<img\s/gi) ?? []).length,
    lastRunConclusion,
  };

  const ctx: ScoreContext = { user: owner, languageCounts, now };

  yield { t: "dispatch", instrument: "sextant", request: `score(${repo}) · rubric v3 · 0 calls` };
  const t0 = performance.now();
  const scored = score(signals, ctx);
  const scoreMs = Math.round((performance.now() - t0) * 100) / 100;
  yield {
    t: "receive",
    instrument: "sextant",
    request: `score(${repo})`,
    status: 200,
    ms: scoreMs,
    cached: false,
    summary: Object.entries(scored.axes)
      .map(([k, a]) => `${k.slice(0, 4)}=${Math.round(a.value)}`)
      .join(" "),
  };
  yield {
    t: "note",
    instrument: "sextant",
    text: `Composite ${scored.composite} → ${scored.classification}. Scoring made no network calls and read no clock: the evaluation instant was passed in. That is what makes this number reproducible by anyone who clones the repository.`,
  };

  /* ── Herald and Plumb: the same code the pipeline publishes with ─────── */
  yield { t: "dispatch", instrument: "herald", request: `compose(${repo}) · templates · 0 calls` };
  const claims = heraldCompose(signals, scored);
  yield {
    t: "receive",
    instrument: "herald",
    request: `compose(${repo})`,
    status: 200,
    ms: 0,
    cached: false,
    summary: `${claims.length} claims drafted`,
  };

  yield { t: "dispatch", instrument: "plumb", request: `verify(${claims.length} claims) · 0 calls` };
  const report = verify(signals, claims);
  yield {
    t: "receive",
    instrument: "plumb",
    request: `verify(${repo})`,
    status: 200,
    ms: 0,
    cached: false,
    summary: `${report.upheld.length} upheld · ${report.rejected.length} rejected`,
  };
  yield {
    t: "note",
    instrument: "plumb",
    text:
      report.rejected.length === 0
        ? `Every clause Herald wrote resolves against a path in the tree that was just fetched. Nothing was published on trust.`
        : `${report.rejected.length} clause${report.rejected.length === 1 ? "" : "s"} failed verification and will not ship. The reason is printed beside each one.`,
  };

  yield {
    t: "done",
    repo,
    composite: scored.composite,
    classification: scored.classification,
    axes: Object.fromEntries(
      Object.entries(scored.axes).map(([k, a]) => [k, Math.round(a.value * 10) / 10]),
    ),
    upheld: report.upheld.map((c) => c.text),
    rejected: report.rejected.map((c) => ({ text: c.text, rejection: c.rejection ?? "unstated" })),
    facts: heraldFacts(signals, scored).map((f) => ({ label: f.label, value: f.value })),
    stack: topLanguages(signals, 6),
    elapsed: session.elapsed,
    calls: session.calls.length,
    network: session.networkCalls,
    cacheHits: session.cacheHits,
    now,
  };
}
