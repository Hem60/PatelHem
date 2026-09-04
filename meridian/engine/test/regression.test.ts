import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadCatalogue } from "../src/adapter.js";
import { isCatalogueEntry, languageCounts, score } from "../src/score.js";
import type { ScoreContext } from "../src/signals.js";

/**
 * Pinned against the real account as collected on 2026-08-26. These numbers
 * are the contract: if a change moves them, it must move them on purpose.
 *
 * The fixture is a FROZEN COPY, and that is the point.
 *
 * This used to read `phase00/out/raw.json` — the file the survey overwrites
 * with a fresh collection every run. So the moment the account changed, this
 * suite compared today's repositories against August's expectations and
 * failed: vakil gained a commit, a new repository appeared, and six assertions
 * broke without a line of engine code moving. Worse, the failures blocked the
 * survey from publishing, so a correct reading could not reach the site.
 *
 * A regression test pins CODE against KNOWN INPUT. If the input moves with the
 * account, it is not a regression test — it is a diff against yesterday. The
 * fixture is committed and never rewritten by the survey; to re-pin it
 * deliberately, copy a new collection over it and update the numbers below in
 * the same commit.
 */
const DATA = fileURLToPath(new URL("./fixtures/account-2026-08-26.json", import.meta.url));

describe.skipIf(!existsSync(DATA))("regression — real catalogue", () => {
  const cat = loadCatalogue(DATA);
  const ctx: ScoreContext = {
    user: cat.user,
    languageCounts: languageCounts(cat.repos),
    now: cat.collectedAt,
  };
  const rows = cat.repos
    .filter(r => isCatalogueEntry(r, cat.user))
    .map(r => score(r, ctx));
  const byName = (n: string) => rows.find(r => r.name === n)!;

  it("catalogues five entries, excluding three forks and the profile repo", () => {
    expect(cat.repos).toHaveLength(9);
    expect(rows).toHaveLength(5);
    expect(rows.map(r => r.name)).not.toContain("Hem60");
    expect(rows.map(r => r.name)).not.toContain("VortiFi");
  });

  it("scores vakil as EPIC on the strength of its stability", () => {
    const v = byName("vakil");
    expect(v.composite).toBe(67.4);
    expect(v.classification).toBe("EPIC");
    expect(v.axes.stability.value).toBeCloseTo(89.3, 1);
    // The manifest-reading fix is worth 28 points here; without it vakil
    // scores 55.7 and reads as RARE.
    expect(v.axes.stability.evidence["strict"]).toBe(true);
  });

  it("credits vakil's commits entirely to the account owner", () => {
    expect(byName("vakil").authorship).toEqual({ mine: 27, total: 27, share: 100 });
  });

  it("reports zero authorship where the commits are attributed elsewhere", () => {
    // IRIS-PREDICTOR is owned by Hem60 but its commits carry another identity.
    expect(byName("IRIS-PREDICTOR").authorship.share).toBe(0);
  });

  it("keeps the ladder discriminating on at least three bands", () => {
    const bands = new Set(rows.map(r => r.classification));
    expect(bands.size).toBeGreaterThanOrEqual(3);
  });

  it("orders the catalogue the way phase 00 did", () => {
    const order = [...rows].sort((a, b) => b.composite - a.composite).map(r => r.name);
    expect(order).toEqual(["vakil", "RAG-CHAT-BOT", "IRIS-PREDICTOR", "MOVIE_RECOMMENDER", "webathon"]);
  });

  it("counts primary languages from the languages map, not a nullable field", () => {
    // Phase 00 trusted GitHub's `language`, which is null for a repo too
    // small to classify. Reading the languages map instead counts webathon's
    // HTML, which pushes HTML past the distinctness limit and costs
    // IRIS-PREDICTOR and MOVIE_RECOMMENDER 6 anomaly points each.
    expect(languageCounts(cat.repos)["HTML"]).toBe(3);
    expect(byName("IRIS-PREDICTOR").axes.anomaly.parts["repeatedStack"]).toBe(-6);
  });
});
