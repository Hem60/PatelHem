import { describe, expect, it } from "vitest";
import { anomaly, cadence, clamp, log, luminosity, mass, stability } from "../src/axes.js";
import { emptySignals, type ScoreContext } from "../src/signals.js";

const ctx: ScoreContext = { user: "someone", languageCounts: {}, now: "2026-08-26T00:00:00Z" };

describe("helpers", () => {
  it("clamps into range", () => {
    expect(clamp(-10)).toBe(0);
    expect(clamp(150)).toBe(100);
    expect(clamp(42)).toBe(42);
  });

  it("log awards nothing for zero and everything at full", () => {
    expect(log(0, 100, 20)).toBe(0);
    expect(log(100, 100, 20)).toBeCloseTo(20, 5);
  });

  it("log has diminishing returns and never exceeds its cap", () => {
    const first = log(10, 100, 20);
    const second = log(20, 100, 20) - first;
    expect(second).toBeLessThan(first);
    expect(log(10_000, 100, 20)).toBe(20);
  });
});

describe("stability", () => {
  it("is zero for an empty repository", () => {
    expect(stability(emptySignals()).value).toBe(0);
  });

  it("reads test config from inside pyproject.toml, not just dotfiles", () => {
    // The bug found in phase 00: scoring the layout instead of the project.
    const bare = stability(emptySignals({ paths: ["src/app.py", "pyproject.toml"] }));
    const configured = stability(emptySignals({
      paths: ["src/app.py", "pyproject.toml"],
      manifests: { "pyproject.toml": "[tool.pytest.ini_options]\naddopts = \"-q\"\n[tool.ruff]\n[tool.mypy]\nstrict = true" },
    }));
    expect(configured.value - bare.value).toBe(28);
    expect(configured.evidence["strict"]).toBe(true);
  });

  it("credits strict typing above loose typing", () => {
    const loose = stability(emptySignals({ manifests: { "package.json": "\"typescript\": \"^5\"" } }));
    const strict = stability(emptySignals({ manifests: { "tsconfig.json": "\"typescript\":1, \"strict\": true" } }));
    expect(strict.parts["typing"]).toBe(8);
    expect(loose.parts["typing"]).toBe(5);
  });

  it("only awards a green run when CI actually exists", () => {
    const noCI = stability(emptySignals({ lastRunConclusion: "success" }));
    expect(noCI.parts["ciGreen"]).toBe(0);
    const withCI = stability(emptySignals({
      paths: [".github/workflows/test.yml"], lastRunConclusion: "success",
    }));
    expect(withCI.parts["ciGreen"]).toBe(12);
  });

  it("never exceeds 100", () => {
    const everything = stability(emptySignals({
      paths: [".github/workflows/ci.yml", "tests/test_a.py", "tests/test_b.py", ".eslintrc", "tsconfig.json", "package-lock.json", "pytest.ini"],
      manifests: { "pyproject.toml": "[tool.mypy]\nstrict = true\n[tool.ruff]\n[tool.pytest]" },
      license: "MIT", lastRunConclusion: "success",
    }));
    expect(everything.value).toBeLessThanOrEqual(100);
  });
});

describe("mass", () => {
  it("rewards commits with diminishing returns", () => {
    const few = mass(emptySignals({ commitCount: 10 }), ctx).value;
    const many = mass(emptySignals({ commitCount: 100 }), ctx).value;
    const huge = mass(emptySignals({ commitCount: 1000 }), ctx).value;
    expect(many).toBeGreaterThan(few);
    expect(huge - many).toBeLessThan(many - few);
  });

  it("does not go negative when pushedAt precedes createdAt", () => {
    // Real data: forks report a push older than the fork date.
    const a = mass(emptySignals({ createdAt: "2026-08-20T00:00:00Z", pushedAt: "2026-08-01T00:00:00Z" }), ctx);
    expect(a.parts["lifespan"]).toBe(0);
    expect(a.value).toBeGreaterThanOrEqual(0);
  });
});

describe("anomaly", () => {
  it("sits at a neutral 50 with no signal either way", () => {
    expect(anomaly(emptySignals(), ctx).value).toBe(50);
  });

  it("rewards an uncommon domain and penalises an over-represented one", () => {
    const rare = anomaly(emptySignals({ description: "chargeback adjudication with an audit trail" }), ctx);
    const common = anomaly(emptySignals({ description: "a movie recommender tutorial" }), ctx);
    expect(rare.value).toBe(72);
    expect(common.value).toBe(30);
  });

  it("reads topics, not just the description", () => {
    const viaTopics = anomaly(emptySignals({ topics: ["retrieval-augmented-generation"] }), ctx);
    expect(viaTopics.evidence["rareDomain"]).toBe(true);
  });

  it("discounts a stack repeated across the catalogue", () => {
    const repeated = anomaly(
      emptySignals({ languages: { Python: 100 } }),
      { ...ctx, languageCounts: { Python: 5 } },
    );
    expect(repeated.parts["repeatedStack"]).toBe(-6);
  });

  it("stays inside 0..100 even when every rule fires", () => {
    const s = anomaly(emptySignals({
      description: "on-chain settlement attestation with policy-as-code and an eval harness",
      paths: ["contracts/A.sol", "evals/run.py"],
      languages: { Solidity: 1, Rust: 1, Go: 1 },
    }), ctx);
    expect(s.value).toBeLessThanOrEqual(100);
    expect(s.value).toBeGreaterThanOrEqual(0);
  });
});

describe("luminosity", () => {
  it("pays for a deployment only when the URL actually answers", () => {
    const dead = luminosity(emptySignals({ homepage: "https://x.invalid", homepageStatus: 404 }));
    const live = luminosity(emptySignals({ homepage: "https://x.invalid", homepageStatus: 200 }));
    expect(dead.parts["deployed"]).toBe(8);
    expect(live.parts["deployed"]).toBe(30);
  });

  it("caps social proof so stars can never carry a repository", () => {
    const famous = luminosity(emptySignals({ stars: 50_000, forks: 9_000 }));
    expect(famous.parts["social"]).toBe(5);
    expect(famous.value).toBeLessThan(10);
  });
});

describe("cadence", () => {
  it("decays with time since the last push", () => {
    const fresh = cadence(emptySignals({ pushedAt: "2026-08-25T00:00:00Z" }), ctx);
    const stale = cadence(emptySignals({ pushedAt: "2024-01-01T00:00:00Z" }), ctx);
    expect(fresh.parts["recency"]).toBe(30);
    expect(stale.parts["recency"]).toBe(0);
  });

  it("separates sustained work from a single burst", () => {
    const burst = cadence(emptySignals({
      commitDates: Array.from({ length: 30 }, () => "2026-08-25T10:00:00Z"),
    }), ctx);
    const sustained = cadence(emptySignals({
      commitDates: ["2026-06-01", "2026-07-02", "2026-08-03"].map(d => `${d}T10:00:00Z`),
    }), ctx);
    expect(burst.parts["sustained"]).toBe(0);
    expect(sustained.parts["sustained"]).toBe(10);
  });
});
