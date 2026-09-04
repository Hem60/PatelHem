import { emptySignals, score, type ScoreContext } from "@meridian/engine";
import { describe, expect, it } from "vitest";
import { compose, facts, TEMPLATES, topLanguages } from "../src/herald.js";

const ctx: ScoreContext = { user: "Hem60", languageCounts: {}, now: "2026-08-26T00:00:00Z" };
const sc = (s: ReturnType<typeof emptySignals>) => score(s, ctx);

describe("herald", () => {
  it("writes nothing at all for an empty repository", () => {
    // No evidence, no sentences. Silence is the correct output.
    const s = emptySignals();
    expect(compose(s, sc(s))).toHaveLength(0);
  });

  it("every template declares at least one citation", () => {
    const s = emptySignals({
      paths: ["tests/t.py", ".github/workflows/ci.yml", "Dockerfile", "docs/a.md", "evals/e.py"],
      manifests: { "pyproject.toml": "[tool.mypy]\nstrict = true\n[tool.ruff]" },
      languages: { Python: 10 }, commitCount: 5, license: "MIT",
      homepage: "https://x", homepageStatus: 200,
    });
    for (const claim of compose(s, sc(s))) {
      expect(claim.cites.length, claim.template).toBeGreaterThan(0);
    }
  });

  it("template ids are unique", () => {
    const ids = TEMPLATES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("is deterministic — same signals, same sentences, same order", () => {
    const s = emptySignals({ paths: ["tests/t.py"], commitCount: 3, languages: { Go: 1 } });
    expect(compose(s, sc(s))).toEqual(compose(s, sc(s)));
  });

  it("counts real test files rather than rounding up", () => {
    const s = emptySignals({ paths: ["tests/test_a.py", "tests/test_b.py", "tests/README.md"] });
    const claim = compose(s, sc(s)).find(c => c.template === "tests");
    expect(claim?.text).toContain("2 test files");
  });

  it("uses the singular where the count is one", () => {
    const s = emptySignals({ paths: ["tests/test_only.py"] });
    expect(compose(s, sc(s)).find(c => c.template === "tests")?.text).toContain("1 test file");
  });

  it("only claims a green CI run when the run was actually green", () => {
    const base = { paths: [".github/workflows/ci.yml"] };
    const failing = emptySignals({ ...base, lastRunConclusion: "failure" });
    const passing = emptySignals({ ...base, lastRunConclusion: "success" });
    expect(compose(failing, sc(failing)).find(c => c.template === "ci")?.text).not.toContain("green");
    expect(compose(passing, sc(passing)).find(c => c.template === "ci")?.text).toContain("green");
  });

  it("does not claim a Compose stack from a bare Dockerfile", () => {
    const bare = emptySignals({ paths: ["Dockerfile"] });
    const composed = emptySignals({ paths: ["Dockerfile", "docker-compose.yml"] });
    expect(compose(bare, sc(bare)).find(c => c.template === "container")?.text).not.toContain("Compose");
    expect(compose(composed, sc(composed)).find(c => c.template === "container")?.text).toContain("Compose");
  });

  it("mentions a span only when work is spread over months", () => {
    const burst = emptySignals({ commitCount: 27, commitDates: ["2026-08-25T00:00:00Z", "2026-08-26T00:00:00Z"] });
    const spread = emptySignals({ commitCount: 27, commitDates: ["2026-06-01T00:00:00Z", "2026-08-26T00:00:00Z"] });
    expect(compose(burst, sc(burst)).find(c => c.template === "scale")?.text).toBe("27 commits.");
    expect(compose(spread, sc(spread)).find(c => c.template === "scale")?.text).toContain("across 2 months");
  });

  it("orders languages by size and lists them readably", () => {
    const s = emptySignals({ languages: { Python: 100, Shell: 5, TypeScript: 50 } });
    expect(topLanguages(s)).toEqual(["Python", "TypeScript", "Shell"]);
    expect(compose(s, sc(s)).find(c => c.template === "stack")?.text)
      .toBe("Written in Python, TypeScript and Shell.");
  });

  it("does not claim a build file as a language", () => {
    // GitHub reports Makefile and Dockerfile in the languages map. Neither
    // is something a person writes a project "in".
    const s = emptySignals({ languages: { Python: 100, Makefile: 50, Dockerfile: 20 } });
    expect(topLanguages(s)).toEqual(["Python"]);
    expect(compose(s, sc(s)).find(c => c.template === "stack")?.text).toBe("Written in Python.");
  });

  it("reports the licence it actually found", () => {
    const s = emptySignals({ license: "Apache-2.0" });
    expect(compose(s, sc(s)).find(c => c.template === "licensed")?.text).toBe("Released under Apache-2.0.");
  });
});

describe("facts", () => {
  it("omits facts with no evidence behind them", () => {
    const s = emptySignals();
    const labels = facts(s, sc(s)).map(f => f.label);
    expect(labels).not.toContain("Commits");
    expect(labels).not.toContain("Licence");
    expect(labels).toContain("Score");
  });

  it("reports measured values, not rounded claims", () => {
    const s = emptySignals({ commitCount: 27, license: "MIT", paths: ["tests/test_a.py"] });
    const table = Object.fromEntries(facts(s, sc(s)).map(f => [f.label, f.value]));
    expect(table["Commits"]).toBe("27");
    expect(table["Tests"]).toBe("1");
    expect(table["Licence"]).toBe("MIT");
  });
});
