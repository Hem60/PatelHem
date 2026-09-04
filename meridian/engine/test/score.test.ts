import { describe, expect, it } from "vitest";
import { authorshipOf, isCatalogueEntry, languageCounts, score, WEIGHTS } from "../src/score.js";
import { emptySignals, type ScoreContext, type Signals } from "../src/signals.js";
import { explain } from "../src/explain.js";

const ctx: ScoreContext = { user: "Hem60", languageCounts: {}, now: "2026-08-26T12:33:00Z" };

describe("weights", () => {
  it("sum to exactly 1", () => {
    const total = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it("rank stability above mass, so correctness beats size", () => {
    expect(WEIGHTS.stability).toBeGreaterThan(WEIGHTS.mass);
    expect(WEIGHTS.mass).toBeGreaterThan(WEIGHTS.anomaly);
    expect(WEIGHTS.luminosity).toBeGreaterThan(WEIGHTS.cadence);
  });
});

describe("score", () => {
  it("is deterministic across repeated calls", () => {
    const s = emptySignals({ name: "x", commitCount: 40, description: "an audit trail service" });
    const a = score(s, ctx);
    const b = score(s, ctx);
    expect(a).toEqual(b);
  });

  it("does not depend on wall-clock time", () => {
    // `now` is injected, never read from the system. This is what makes a
    // published rank reproducible by anyone who clones the repository.
    const s = emptySignals({ pushedAt: "2026-08-20T00:00:00Z" });
    const early = score(s, { ...ctx, now: "2026-08-21T00:00:00Z" });
    const later = score(s, { ...ctx, now: "2026-12-01T00:00:00Z" });
    expect(early.composite).not.toBe(later.composite);
    expect(score(s, ctx)).toEqual(score(s, ctx));
  });

  it("keeps the composite inside 0..100", () => {
    expect(score(emptySignals(), ctx).composite).toBeGreaterThanOrEqual(0);
    const maxed = score(emptySignals({
      paths: [".github/workflows/ci.yml", "tests/t.py", "docs/x.md", "contracts/A.sol", "evals/e.py", "package-lock.json"],
      manifests: { "pyproject.toml": "[tool.mypy]\nstrict = true\n[tool.ruff]\n[tool.pytest]\n[project]" },
      license: "MIT", lastRunConclusion: "success", commitCount: 5000,
      languages: { Rust: 900_000, Solidity: 5000, Go: 5000 },
      homepage: "https://x", homepageStatus: 200, readmeLength: 20_000, readmeImages: 4,
      description: "on-chain settlement attestation", topics: ["a"], releaseCount: 9,
      stars: 900, forks: 90, openIssues: 40,
      createdAt: "2020-01-01T00:00:00Z", pushedAt: "2026-08-26T00:00:00Z",
      commitDates: Array.from({ length: 100 }, (_, i) => `2026-0${(i % 8) + 1}-1${i % 10}T00:00:00Z`),
    }), ctx);
    expect(maxed.composite).toBeLessThanOrEqual(100);
  });

  it("equals the weighted sum of its axes", () => {
    const r = score(emptySignals({ commitCount: 27, license: "MIT" }), ctx);
    const manual = (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[])
      .reduce((t, k) => t + r.axes[k].value * WEIGHTS[k], 0);
    expect(r.composite).toBeCloseTo(Math.round(manual * 10) / 10, 5);
  });
});

describe("authorship", () => {
  it("computes a real share rather than asserting one", () => {
    const s = emptySignals({
      contributors: [{ login: "Ayush3422", contributions: 26 }, { login: "Hem60", contributions: 12 }],
    });
    expect(authorshipOf(s, "Hem60")).toEqual({ mine: 12, total: 38, share: 32 });
  });

  it("reports zero when the commits belong to someone else", () => {
    const s = emptySignals({ contributors: [{ login: "CODER7657", contributions: 18 }] });
    expect(authorshipOf(s, "Hem60")).toEqual({ mine: 0, total: 18, share: 0 });
  });

  it("returns a null share when GitHub reports no contributors", () => {
    expect(authorshipOf(emptySignals(), "Hem60").share).toBeNull();
  });

  it("matches the login case-insensitively", () => {
    const s = emptySignals({ contributors: [{ login: "hem60", contributions: 5 }] });
    expect(authorshipOf(s, "Hem60").mine).toBe(5);
  });
});

describe("catalogue membership", () => {
  it("excludes forks and the profile repository", () => {
    expect(isCatalogueEntry(emptySignals({ name: "vakil" }), "Hem60")).toBe(true);
    expect(isCatalogueEntry(emptySignals({ name: "VortiFi", fork: true }), "Hem60")).toBe(false);
    expect(isCatalogueEntry(emptySignals({ name: "Hem60" }), "Hem60")).toBe(false);
  });

  it("counts primary languages across a catalogue", () => {
    const all: Signals[] = [
      emptySignals({ languages: { Python: 10 } }),
      emptySignals({ languages: { Python: 20 } }),
      emptySignals({ languages: { TypeScript: 5 } }),
      emptySignals({}),
    ];
    expect(languageCounts(all)).toEqual({ Python: 2, TypeScript: 1 });
  });
});

describe("explain", () => {
  const r = score(emptySignals({
    name: "vakil", commitCount: 27, license: "MIT",
    description: "autonomous chargeback defence agent",
  }), ctx);

  it("prints every axis with its weighted contribution", () => {
    const text = explain(r);
    for (const axis of ["stability", "mass", "anomaly", "luminosity", "cadence"]) {
      expect(text).toContain(axis);
    }
    expect(text).toContain("composite");
  });

  it("names the next gate and the cheapest way to reach it", () => {
    const text = explain(r);
    expect(text).toContain("next gate");
    expect(text).toMatch(/cheapest route|needs work on several/);
  });

  it("hides zero-scoring signals unless asked", () => {
    expect(explain(r, { verbose: true }).length).toBeGreaterThan(explain(r).length);
  });
});
