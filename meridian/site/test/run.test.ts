/**
 * Phase 05 tests.
 *
 * The run itself needs a network and a rate limit, so what is worth holding
 * still here is everything around it: the target allow-list, the context it
 * scores against, and the promise the panel makes about what it will report.
 */
import { describe, expect, it } from "vitest";
import { catalogue } from "../lib/catalogue";
import { runContext } from "../lib/run/context";
import { ESTIMATED_CALLS, INSTRUMENT_IDS } from "../lib/run/plan";
import { GET } from "../app/api/run/route";

const cat = catalogue();

describe("the run's target list", () => {
  it("refuses a repository the catalogue does not list", async () => {
    const res = await GET(new Request("http://localhost/api/run?repo=someone-elses-repo"));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("not in the catalogue");
  });

  it("refuses an empty target rather than surveying something arbitrary", async () => {
    const res = await GET(new Request("http://localhost/api/run"));
    expect(res.status).toBe(400);
  });

  it("accepts every catalogued repository", async () => {
    /* the stream is not consumed here — only the admission decision is */
    for (const entry of cat.entries) {
      const res = await GET(new Request(`http://localhost/api/run?repo=${encodeURIComponent(entry.name)}`));
      expect(res.status, entry.name).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/event-stream");
      await res.body?.cancel();
    }
  });
});

describe("the scoring context a live run uses", () => {
  const ctx = runContext(cat);

  it("counts only languages the catalogue actually publishes", () => {
    const published = new Set(cat.entries.flatMap((e) => e.stack));
    for (const lang of Object.keys(ctx.languageCounts)) expect(published.has(lang)).toBe(true);
  });

  it("never claims more support for a language than there are entries", () => {
    for (const [lang, count] of Object.entries(ctx.languageCounts)) {
      expect(count, lang).toBeGreaterThan(0);
      expect(count, lang).toBeLessThanOrEqual(cat.entries.length);
    }
  });

  it("declares itself an approximation, because it is one", () => {
    /* anomaly scores a repository against the account. A live run reads that
       distribution from stack lists rather than full language maps, and the
       panel is required to say so. */
    expect(ctx.approximated).toBe(true);
    expect(ctx.basis).toContain("stack lists");
  });
});

describe("what the panel promises before it runs", () => {
  it("draws one lane per instrument, in dispatch order", () => {
    expect([...INSTRUMENT_IDS]).toEqual(["almanac", "prism", "sextant", "herald", "plumb"]);
  });

  it("states a call estimate the run can be held to", () => {
    expect(ESTIMATED_CALLS).toBe(10);
  });
});
