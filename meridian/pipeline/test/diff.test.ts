import { emptySignals, score, type Classification, type ScoreContext, type ScoredRepo } from "@meridian/engine";
import { describe, expect, it } from "vitest";
import { emptyCatalogue, dominantAxis, type Catalogue } from "../src/catalogue.js";
import { advance, diff } from "../src/diff.js";

const NOW = "2026-08-26T00:00:00Z";
const ctx: ScoreContext = { user: "Hem60", languageCounts: {}, now: NOW };

/** A scored repo pinned to an exact composite, for gate arithmetic. */
function at(name: string, composite: number): ScoredRepo {
  const base = score(emptySignals({ name }), ctx);
  return { ...base, composite, classification: composite >= 76 ? "LEGENDARY" : composite >= 64 ? "EPIC" : composite >= 50 ? "RARE" : composite >= 34 ? "UNCOMMON" : "COMMON" };
}

const withState = (
  name: string, current: Classification, history: number[], since = "2026-01-01T00:00:00Z",
): Catalogue => ({
  ...emptyCatalogue("Hem60", NOW),
  state: { [name]: { current, since, history, axesAtGrant: { stability: 12, mass: 0, anomaly: 50, luminosity: 0, cadence: 0 }, compositeAtGrant: 0 } },
});

describe("diff", () => {
  it("marks an unseen repository as new", () => {
    const r = diff(emptyCatalogue("Hem60", NOW), [at("vakil", 67.4)], NOW);
    expect(r.changes[0]).toMatchObject({ kind: "new", repo: "vakil" });
    expect(r.dirty).toBe(true);
  });

  it("exits clean when nothing moved", () => {
    // The rule that keeps the repository history from filling with commits
    // that say nothing changed.
    const prev = withState("vakil", "EPIC", [67.4]);
    const r = diff(prev, [at("vakil", 67.4)], NOW);
    expect(r.changes[0]?.kind).toBe("hold");
    expect(r.dirty).toBe(false);
  });

  it("records a rescore that does not cross a class boundary", () => {
    const prev = withState("vakil", "EPIC", [67.4]);
    const r = diff(prev, [at("vakil", 69.1)], NOW);
    expect(r.changes[0]).toMatchObject({ kind: "rescore", delta: 1.7 });
    expect(r.dirty).toBe(true);
  });

  it("holds a promotion until hysteresis is satisfied, recording it as a rescore", () => {
    // One good run is not enough. The score is still written down, but the
    // class does not move and no revision is published.
    const prev = withState("vakil", "EPIC", [67.4]);
    expect(diff(prev, [at("vakil", 79)], NOW).changes[0])
      .toMatchObject({ kind: "rescore", delta: 11.6 });
  });

  it("promotes once two consecutive runs clear the margin", () => {
    const prev = withState("vakil", "EPIC", [79]);
    expect(diff(prev, [at("vakil", 80)], NOW).changes[0])
      .toMatchObject({ kind: "promote", repo: "vakil", fromClass: "EPIC" });
  });

  it("does not demote inside the class floor", () => {
    const prev = withState("vakil", "LEGENDARY", [40, 40], "2026-08-20T00:00:00Z");
    expect(diff(prev, [at("vakil", 40)], NOW).changes[0]?.kind).not.toBe("demote");
  });
});

describe("advance", () => {
  it("stamps a new class with the date it was granted", () => {
    const prev = withState("vakil", "EPIC", [79]);
    const scored = [at("vakil", 80)];
    const changes = diff(prev, scored, NOW).changes;
    const next = advance(prev, scored, changes, NOW);
    expect(next["vakil"]?.current).toBe("LEGENDARY");
    expect(next["vakil"]?.since).toBe(NOW);
  });

  it("preserves the original grant date when the class holds", () => {
    const prev = withState("vakil", "EPIC", [67.4], "2026-03-01T00:00:00Z");
    const scored = [at("vakil", 68)];
    const next = advance(prev, scored, diff(prev, scored, NOW).changes, NOW);
    expect(next["vakil"]?.since).toBe("2026-03-01T00:00:00Z");
  });

  it("snapshots the axes when a class is granted, and keeps them while it holds", () => {
    // A promotion is explained against the state it promoted from. Without
    // this snapshot the cause reads "stability 97.3 -> 97.3", because
    // hysteresis lands the improvement a run before the class moves.
    const prev = withState("vakil", "EPIC", [79]);
    const scored = [at("vakil", 80)];
    const promoted = advance(prev, scored, diff(prev, scored, NOW).changes, NOW);
    expect(promoted["vakil"]?.axesAtGrant["stability"]).not.toBe(12);

    const asCatalogue: Catalogue = { ...emptyCatalogue("Hem60", NOW), state: promoted };
    const held = advance(asCatalogue, scored, diff(asCatalogue, scored, NOW).changes, NOW);
    expect(held["vakil"]?.axesAtGrant).toEqual(promoted["vakil"]?.axesAtGrant);
  });

  it("appends to history and bounds its length", () => {
    const prev = withState("vakil", "EPIC", [1, 2, 3, 4, 5, 6, 7, 8]);
    const scored = [at("vakil", 67.4)];
    const next = advance(prev, scored, diff(prev, scored, NOW).changes, NOW, 8);
    expect(next["vakil"]?.history).toHaveLength(8);
    expect(next["vakil"]?.history.at(-1)).toBe(67.4);
    expect(next["vakil"]?.history.at(0)).toBe(2);
  });
});

describe("dominantAxis", () => {
  const after = score(emptySignals({
    name: "vakil", paths: [".github/workflows/ci.yml", "tests/t.py"],
    license: "MIT", lastRunConclusion: "success",
  }), ctx);

  it("names the axis that actually moved, not simply the largest one", () => {
    // anomaly sits at a neutral 50 and never moved; stability climbed from
    // 12. Comparing against the previous entry is what tells them apart.
    const cause = dominantAxis({ stability: 12, mass: 0, anomaly: 50, luminosity: 0, cadence: 0 }, after);
    expect(cause.axis).toBe("stability");
    expect(cause.from).toBe(12);
    expect(cause.evidence.join(" ")).toContain("ciWorkflow");
  });

  it("falls back to the largest axis on a first sighting", () => {
    expect(dominantAxis(null, after).axis).toBe("anomaly");
  });
});
