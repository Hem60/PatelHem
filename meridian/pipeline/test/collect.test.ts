/**
 * The collector's response decoding.
 *
 * This file exists because one empty repository took down an entire survey.
 *
 * A repository created on the web and never pushed to has no commits, and
 * GitHub answers `GET /repos/{owner}/{repo}/contributors` for it with 204 No
 * Content and a zero-length body. `gh api` prints nothing, and the collector
 * ran `JSON.parse("")` on it:
 *
 *     SyntaxError: Unexpected end of JSON input
 *       at api (phase00/gh.mjs:32)
 *       at collectRepo (phase00/gh.mjs:62)
 *
 * That threw out of the loop on the third repository of sixteen, so the run
 * failed before anything else was measured and nothing on the site could
 * update. Every consumer inside `collectRepo` was already defensive —
 * `__error` checks, `Array.isArray`, optional chaining — and none of it
 * mattered, because the throw happened before any of them were reached.
 *
 * An empty body is now reported in the shape those consumers already branch
 * on. `__error` in this collector does not mean "the request failed"; it
 * means "there is nothing usable here", which is precisely what 204 says.
 */
import { describe, expect, it } from "vitest";
// @ts-expect-error — a plain .mjs collector, deliberately outside the TS build
import { decode } from "../../phase00/gh.mjs";

describe("decoding a GitHub response body", () => {
  it("does not throw on the empty body a 204 returns", () => {
    /* the exact crash: JSON.parse("") */
    expect(() => decode("")).not.toThrow();
  });

  it("reports an empty body in the shape collectRepo already handles", () => {
    const got = decode("");
    expect(got.__error).toBe(true);
    expect(got.status).toBe(204);
    /* distinguishable from a real failure for anyone reading the cache */
    expect(got.__empty).toBe(true);
  });

  it("treats a whitespace-only body as empty too", () => {
    expect(decode("  \n  ").__empty).toBe(true);
  });

  it("still parses an ordinary list", () => {
    expect(decode('[{"login":"Hem60","contributions":30}]')).toEqual([
      { login: "Hem60", contributions: 30 },
    ]);
  });

  it("still parses an ordinary object", () => {
    expect(decode('{"Python":715}')).toEqual({ Python: 715 });
  });

  it("is never mistaken for a list, so Array.isArray guards hold", () => {
    /*
     * The three call sites that matter read contributors and commits through
     * `Array.isArray(...)`. An empty body must fail that check rather than
     * arriving as [] and being counted as "this repository has no
     * contributors" when the truth is "this repository has no commits".
     */
    expect(Array.isArray(decode(""))).toBe(false);
  });

  it("throws on a body that is genuinely malformed", () => {
    /* an empty body is a real answer; a truncated one is a bug worth seeing */
    expect(() => decode("{ not json")).toThrow();
  });
});
