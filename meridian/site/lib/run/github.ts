/**
 * The transport the instruments actually use.
 *
 * Every call this makes is a real HTTPS request to api.github.com, and every
 * latency this reports is measured with a clock around that request. Nothing
 * here is simulated, staged, or slowed down to look busy — the whole argument
 * of the Observing Run is that a visitor with a network tab open sees exactly
 * what the panel claims, so a fake timing would be worse than no console.
 *
 * Two behaviours worth stating plainly because the panel prints them:
 *
 *   - Authentication is optional. With a token the rate limit is 5,000 an
 *     hour; without one it is 60, shared by everybody. The session reports
 *     which mode it ran in and what the API says is left.
 *   - Responses are cached per commit SHA. A cached read is labelled cached
 *     in the transcript, with the disk read time rather than a network time
 *     it did not spend.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const API = "https://api.github.com";

export interface CallRecord {
  /** The path as requested, without the host. Printed in the transcript. */
  readonly path: string;
  readonly status: number;
  /** Milliseconds, measured. One decimal, because that is what we can defend. */
  readonly ms: number;
  readonly cached: boolean;
  readonly bytes: number;
}

export interface RateLimit {
  readonly limit: number;
  readonly remaining: number;
  /** Unix seconds when the window resets. */
  readonly reset: number;
}

export type Mode = "authenticated" | "anonymous";

/** Where cached responses live. Serverless filesystems are read-only except tmp. */
const CACHE_DIR = process.env.MERIDIAN_CACHE ?? join(tmpdir(), "meridian-cache");

const keyFor = (path: string, sha: string | null): string =>
  createHash("sha1").update(`${sha ?? "head"}|${path}`).digest("hex").slice(0, 32);

export class Session {
  readonly mode: Mode;
  readonly calls: CallRecord[] = [];
  rateLimit: RateLimit | null = null;
  cacheHits = 0;
  cacheWritable = true;

  private readonly token: string | undefined;
  private readonly started = performance.now();

  constructor(token = process.env.GITHUB_TOKEN ?? process.env.MERIDIAN_GITHUB_TOKEN) {
    this.token = token && token.trim().length > 0 ? token.trim() : undefined;
    this.mode = this.token ? "authenticated" : "anonymous";
  }

  get elapsed(): number {
    return Math.round((performance.now() - this.started) * 10) / 10;
  }

  get networkCalls(): number {
    return this.calls.filter((c) => !c.cached).length;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "meridian-observing-run",
    };
    if (this.token) h.authorization = `Bearer ${this.token}`;
    return h;
  }

  private async readCache(key: string): Promise<unknown | null> {
    try {
      const raw = await readFile(join(CACHE_DIR, `${key}.json`), "utf8");
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }

  private async writeCache(key: string, value: unknown): Promise<void> {
    try {
      await mkdir(CACHE_DIR, { recursive: true });
      await writeFile(join(CACHE_DIR, `${key}.json`), JSON.stringify(value), "utf8");
    } catch {
      /* an unwritable cache is a slower run, not a failed one */
      this.cacheWritable = false;
    }
  }

  /**
   * One GET. Returns the parsed body and the record of what it cost.
   *
   * `sha` scopes the cache: a repository that has moved on gets a fresh read
   * because the key changes, which is what "cached per commit SHA" means.
   */
  async get<T>(
    path: string,
    { sha = null, cacheable = true }: { sha?: string | null; cacheable?: boolean } = {},
  ): Promise<{ data: T | null; record: CallRecord }> {
    const key = keyFor(path, sha);
    const t0 = performance.now();

    if (cacheable) {
      const hit = await this.readCache(key);
      if (hit !== null) {
        const record: CallRecord = {
          path,
          status: 200,
          ms: Math.round((performance.now() - t0) * 10) / 10,
          cached: true,
          bytes: JSON.stringify(hit).length,
        };
        this.calls.push(record);
        this.cacheHits += 1;
        return { data: hit as T, record };
      }
    }

    let status = 0;
    let body: unknown = null;
    let bytes = 0;

    try {
      const res = await fetch(`${API}/${path}`, { headers: this.headers(), cache: "no-store" });
      status = res.status;

      const limit = res.headers.get("x-ratelimit-limit");
      const remaining = res.headers.get("x-ratelimit-remaining");
      const reset = res.headers.get("x-ratelimit-reset");
      if (limit && remaining && reset) {
        this.rateLimit = { limit: Number(limit), remaining: Number(remaining), reset: Number(reset) };
      }

      const text = await res.text();
      bytes = text.length;
      body = text.length > 0 ? (JSON.parse(text) as unknown) : null;
    } catch {
      status = 0;
      body = null;
    }

    const record: CallRecord = {
      path,
      status,
      ms: Math.round((performance.now() - t0) * 10) / 10,
      cached: false,
      bytes,
    };
    this.calls.push(record);

    if (status === 200 && cacheable) await this.writeCache(key, body);
    return { data: status === 200 ? (body as T) : null, record };
  }
}

/** Whether the API has told us we are out of budget. */
export function rateLimited(session: Session): boolean {
  return session.rateLimit !== null && session.rateLimit.remaining <= 0;
}
