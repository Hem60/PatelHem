import { emptySignals, score, type ScoreContext } from "@meridian/engine";
import { describe, expect, it } from "vitest";
import { compose } from "../src/herald.js";
import { verify, verifyClaim } from "../src/plumb.js";

const ctx: ScoreContext = { user: "Hem60", languageCounts: {}, now: "2026-08-26T00:00:00Z" };

describe("plumb", () => {
  it("upholds a claim whose cited file exists", () => {
    const s = emptySignals({ paths: [".github/workflows/ci.yml"] });
    const v = verifyClaim(s, { template: "ci", text: "CI is configured.", cites: [".github/workflows/ci.yml"] });
    expect(v.upheld).toBe(true);
  });

  it("rejects a claim whose cited file does not exist", () => {
    // The failure mode Plumb exists to prevent: a sentence about a file
    // the repository does not contain.
    const s = emptySignals({ paths: ["src/app.py"] });
    const v = verifyClaim(s, { template: "ci", text: "CI is configured.", cites: [".github/workflows/ci.yml"] });
    expect(v.upheld).toBe(false);
    expect(v.rejection).toContain("no such path");
  });

  it("rejects a claim with no citation at all", () => {
    const v = verifyClaim(emptySignals(), { template: "x", text: "Trust me.", cites: [] });
    expect(v.upheld).toBe(false);
    expect(v.rejection).toBe("no citation");
  });

  it("rejects a claim whose cited signal is absent", () => {
    const s = emptySignals({ homepageStatus: 404 });
    const v = verifyClaim(s, { template: "deployed", text: "Deployed.", cites: ["signal:homepageStatus"] });
    expect(v.upheld).toBe(false);
    expect(v.rejection).toContain("homepageStatus");
  });

  it("satisfies a directory citation from anything beneath it", () => {
    const s = emptySignals({ paths: ["tests/test_a.py"] });
    expect(verifyClaim(s, { template: "tests", text: "Tested.", cites: ["tests/"] }).upheld).toBe(true);
    expect(verifyClaim(emptySignals(), { template: "tests", text: "Tested.", cites: ["tests/"] }).upheld).toBe(false);
  });

  it("rejects when only one of several citations resolves", () => {
    const s = emptySignals({ paths: ["Dockerfile"] });
    const v = verifyClaim(s, {
      template: "container", text: "Containerised with Compose.",
      cites: ["Dockerfile", "docker-compose.yml"],
    });
    expect(v.upheld).toBe(false);
  });

  it("accepts a manifest as a citable file", () => {
    const s = emptySignals({ manifests: { "pyproject.toml": "[tool.mypy]" } });
    expect(verifyClaim(s, { template: "typing", text: "Typed.", cites: ["pyproject.toml"] }).upheld).toBe(true);
  });

  it("upholds every sentence Herald produces from real signals", () => {
    // Herald and Plumb must agree: a template only fires when its evidence
    // is present, so nothing it writes should ever be rejected.
    const s = emptySignals({
      name: "vakil",
      paths: ["tests/test_a.py", "tests/test_b.py", ".github/workflows/eval.yml", "Dockerfile", "docker-compose.yml", "docs/x.md", "evals/run.py"],
      manifests: { "pyproject.toml": "[tool.mypy]\nstrict = true\n[tool.ruff]" },
      languages: { Python: 1000 }, commitCount: 27, license: "Apache-2.0",
      lastRunConclusion: "success",
    });
    const report = verify(s, compose(s, score(s, ctx)));
    expect(report.rejected).toHaveLength(0);
    expect(report.upheld.length).toBeGreaterThan(5);
  });

  it("catches a template that outruns its evidence", () => {
    // Simulates a future template bug: claiming Compose from a bare
    // Dockerfile. Plumb must stop it reaching a card.
    const s = emptySignals({ paths: ["Dockerfile"] });
    const bad = { template: "container", text: "Compose stack.", cites: ["docker-compose.yml"] };
    const report = verify(s, [bad]);
    expect(report.upheld).toHaveLength(0);
    expect(report.rejected).toHaveLength(1);
  });
});
