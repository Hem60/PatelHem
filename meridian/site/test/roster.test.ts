/**
 * Roster tests.
 *
 * The roster makes two claims that are easy to fake and worth pinning: that
 * each instrument's tool list is the set of calls it really makes, and that
 * the entries filed under an instrument are filed by measurement rather than
 * by preference.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { catalogue } from "../lib/catalogue";
import { SIGILS, axisMean, categoryOf, instrumentFor, ownedBy, sigilOf } from "../lib/sigil";
import { AXES } from "../lib/bands";

const cat = catalogue();
const runSource = readFileSync(join(process.cwd(), "lib", "run", "instruments.ts"), "utf8");

describe("the instruments", () => {
  it("gives every instrument a distinct sigil, colour and axis", () => {
    expect(new Set(SIGILS.map((s) => s.id)).size).toBe(SIGILS.length);
    expect(new Set(SIGILS.map((s) => s.token)).size).toBe(SIGILS.length);
    expect(new Set(SIGILS.map((s) => s.axis)).size).toBe(SIGILS.length);
  });

  it("reads all five axes between them, and no axis the engine does not weight", () => {
    const axes = new Set(AXES.map((a) => a.key as string));
    expect(new Set(SIGILS.map((s) => s.axis))).toEqual(axes);
  });

  it("draws a 5x5 bitmap with at least one lit cell", () => {
    for (const s of SIGILS) {
      expect(s.bits.length, s.id).toBe(25);
      expect(/^[01]+$/.test(s.bits), s.id).toBe(true);
      expect(s.bits.includes("1"), s.id).toBe(true);
    }
  });

  it("only marks an instrument as networked if the run really calls out for it", () => {
    /* Almanac and Prism are the two that fetch; the other three are pure. If
       that ever changes in the run, this fails rather than the roster quietly
       misdescribing what the page does. */
    const networked = SIGILS.filter((s) => s.network).map((s) => s.id).sort();
    expect(networked).toEqual(["almanac", "prism"]);
    for (const id of networked) {
      expect(runSource, id).toContain(`instrument: "${id}"`);
    }
  });

  it("lists tools, and none of them twice", () => {
    for (const s of SIGILS) {
      expect(s.tools.length, s.id).toBeGreaterThan(0);
      expect(new Set(s.tools).size, s.id).toBe(s.tools.length);
    }
    expect(sigilOf("plumb").name).toBe("Plumb");
  });
});

describe("what an instrument owns", () => {
  it("files every catalogued entry under exactly one instrument", () => {
    const counts = SIGILS.map((s) => ownedBy(cat.entries, s.id).length);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(cat.entries.length);
  });

  it("files an entry under the instrument reading its strongest axis", () => {
    for (const entry of cat.entries) {
      const instrument = instrumentFor(entry);
      const mine = entry.axes[instrument.axis] ?? -Infinity;
      for (const other of SIGILS) {
        expect(mine, `${entry.name}: ${other.axis} beats ${instrument.axis}`).toBeGreaterThanOrEqual(
          entry.axes[other.axis] ?? -Infinity,
        );
      }
    }
  });

  it("reports an account mean that matches the entries it averages", () => {
    for (const s of SIGILS) {
      const mean = axisMean(cat.entries, s.axis);
      if (mean === null) continue;
      expect(mean).toBeGreaterThanOrEqual(0);
      expect(mean).toBeLessThanOrEqual(100);
    }
    expect(axisMean([], "stability")).toBeNull();
  });

  it("builds a card category out of measurements, not adjectives", () => {
    for (const entry of cat.entries) {
      const category = categoryOf(entry);
      const [language] = category.split(" · ");
      expect(entry.stack[0] ?? "Unclassified").toBe(language);
    }
  });
});
