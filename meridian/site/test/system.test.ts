/**
 * Phase 03 tests.
 *
 * Three things are worth holding still at this stage: the class ramp must
 * agree with the classes the pipeline actually published, the contrast gate
 * must pass on both plates, and the machine's view of the person must never
 * emit a sentence whose evidence is missing.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BANDS, band, bandOf, classVar, nextClass, AXES } from "../lib/bands";
import { catalogue, entriesByRank, revisions, prose } from "../lib/catalogue";
import { machineView, readout } from "../lib/machine";
import { positions, record } from "../lib/content";
import { figure, plateMark, stamp, daysBetween } from "../lib/format";
import { audit } from "../scripts/contrast.mjs";
import { THRESHOLDS, classify } from "@meridian/engine";

const cat = catalogue();

describe("the class ramp", () => {
  it("names every published composite the same class the pipeline did", () => {
    for (const entry of cat.entries) {
      expect(band(entry.composite).name, entry.name).toBe(entry.classification);
    }
  });

  it("covers the number line without gaps or overlaps", () => {
    for (let i = 0; i < BANDS.length - 1; i++) {
      expect(BANDS[i]!.ceiling).toBe(BANDS[i + 1]!.floor);
    }
    expect(BANDS[BANDS.length - 1]!.ceiling).toBeNull();
  });

  it("gives each class its own colour token and nothing else", () => {
    const tokens = BANDS.map((b) => b.token);
    expect(new Set(tokens).size).toBe(BANDS.length);
    expect(classVar("EPIC")).toBe("var(--c-epic)");
    expect(bandOf("MYTHIC").floor).toBe(88);
    expect(nextClass("MYTHIC")).toBeNull();
    expect(nextClass("EPIC")).toBe("LEGENDARY");
  });

  it("carries the engine's thresholds rather than a second copy of them", () => {
    /* The site draws the ladder; the engine decides it. If these ever disagree
       the page is publishing a class the pipeline did not grant. */
    expect(bandOf("MYTHIC").floor).toBe(THRESHOLDS.MYTHIC);
    expect(bandOf("LEGENDARY").floor).toBe(THRESHOLDS.LEGENDARY);
    expect(bandOf("EPIC").floor).toBe(THRESHOLDS.EPIC);
    expect(bandOf("RARE").floor).toBe(THRESHOLDS.RARE);
    expect(bandOf("UNCOMMON").floor).toBe(THRESHOLDS.UNCOMMON);
  });

  it("agrees with the engine at every tenth of a point from 0 to 100", () => {
    for (let composite = 0; composite <= 100; composite += 0.1) {
      const v = Math.round(composite * 10) / 10;
      expect(band(v).name, `composite ${v}`).toBe(classify(v));
    }
  });

  it("weights the five axes to exactly one", () => {
    const total = AXES.reduce((sum, a) => sum + a.weight, 0);
    expect(Math.round(total * 1000) / 1000).toBe(1);
  });
});

describe("the contrast gate", () => {
  const rows = audit();

  it("checks both plates", () => {
    expect(new Set(rows.map((r) => r.theme))).toEqual(new Set(["night", "day"]));
  });

  it("passes every pair the design composes", () => {
    const failed = rows.filter((r) => !r.pass);
    expect(failed.map((r) => `${r.theme} ${r.fg} on ${r.bg} = ${r.ratio.toFixed(2)}`)).toEqual([]);
  });

  it("checks all six class colours on every ground", () => {
    const classPairs = rows.filter((r) => r.fg.startsWith("--c-"));
    expect(classPairs.length).toBe(6 * 3 * 2);
  });
});

describe("the machine's view", () => {
  const lines = machineView(cat);

  it("says something, and cites something for everything it says", () => {
    expect(lines.length).toBeGreaterThan(3);
    for (const line of lines) {
      expect(line.text.length, line.template).toBeGreaterThan(20);
      if (line.template !== "annotation") expect(line.evidence.length, line.template).toBeGreaterThan(0);
    }
  });

  it("uses a stable template id per sentence", () => {
    const ids = lines.map((l) => l.template);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("emits nothing at all for an empty catalogue", () => {
    expect(machineView({ ...cat, entries: [] })).toEqual([]);
  });

  it("names the top entry as the strongest reading", () => {
    const top = entriesByRank(cat)[0]!;
    const strongest = lines.find((l) => l.template === "strongest");
    expect(strongest?.text).toContain(top.name);
  });
});

describe("the readout", () => {
  const r = readout(cat, revisions().length);

  it("counts what is actually in the catalogue", () => {
    expect(r.catalogued).toBe(cat.entries.length);
    expect(r.lastRun).toBe(cat.generated);
    expect(r.revisionCount).toBe(revisions().length);
  });

  it("does not claim a revision the log does not hold", () => {
    expect(r.revisionCount).toBe(JSON.parse(
      readFileSync(join(process.cwd(), "..", "pipeline", "data", "revisions.json"), "utf8"),
    ).revisions.length);
  });
});

describe("resolution", () => {
  it("buys precision and nothing else", () => {
    expect(figure(67.42, 1)).toBe("67");
    expect(figure(67.42, 3)).toBe("67.4");
    expect(figure(67.42, 8)).toBe("67.42");
  });

  it("prints stamps in UTC, at every resolution", () => {
    expect(stamp("2026-08-26T12:33:08.193Z", 1)).toBe("2026-08-26");
    expect(stamp("2026-08-26T12:33:08.193Z", 8)).toBe("2026-08-26 12:33Z");
    expect(stamp("not a date")).toBe("—");
  });

  it("marks plates by day of year", () => {
    expect(plateMark("2026-01-01T00:00:00.000Z")).toBe("26·001");
    expect(daysBetween("2026-08-26T00:00:00Z", "2026-07-27T00:00:00Z")).toBe(30);
  });
});

describe("authored content", () => {
  it("keeps the written positions separate from the computed one", () => {
    const ids = positions().map((p) => p.id);
    expect(ids).toContain("recruiter");
    expect(ids).toContain("engineer");
    expect(ids).not.toContain("machine");
  });

  it("accepts an empty record strand rather than inventing one", () => {
    expect(Array.isArray(record())).toBe(true);
  });

  it("only annotates entries that have a hand-written thesis", () => {
    const written = prose();
    for (const entry of cat.entries) {
      expect(entry.annotated, entry.name).toBe(entry.name in written);
    }
  });
});
