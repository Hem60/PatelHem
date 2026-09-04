import { describe, expect, it } from "vitest";
import { classify, HYSTERESIS, nextGate, ORDER, THRESHOLDS, transition, type ClassState } from "../src/classify.js";

describe("classify", () => {
  it("maps each band to its class", () => {
    expect(classify(95)).toBe("MYTHIC");
    expect(classify(80)).toBe("LEGENDARY");
    expect(classify(67.4)).toBe("EPIC");
    expect(classify(55)).toBe("RARE");
    expect(classify(39.9)).toBe("UNCOMMON");
    expect(classify(17.5)).toBe("COMMON");
  });

  it("treats every threshold as inclusive", () => {
    for (const [name, value] of Object.entries(THRESHOLDS)) {
      expect(classify(value)).toBe(name);
      expect(classify(value - 0.1)).not.toBe(name);
    }
  });

  it("is monotonic: a higher score never gives a lower class", () => {
    for (let s = 0; s <= 100; s += 0.5) {
      expect(ORDER.indexOf(classify(s))).toBeLessThanOrEqual(ORDER.indexOf(classify(s - 0.5)));
    }
  });
});

describe("nextGate", () => {
  it("points at the next class up and the distance to it", () => {
    expect(nextGate(67.4)).toEqual({ target: "LEGENDARY", gap: 8.6 });
    expect(nextGate(17.5)).toEqual({ target: "UNCOMMON", gap: 16.5 });
  });

  it("returns null at the top of the ladder", () => {
    expect(nextGate(92)).toBeNull();
  });
});

describe("hysteresis", () => {
  const state = (over: Partial<ClassState> = {}): ClassState => ({
    current: "EPIC", since: "2026-01-01T00:00:00Z", history: [], ...over,
  });
  const NOW = "2026-08-26T00:00:00Z";

  it("holds when the class has not changed", () => {
    expect(transition(state(), 70, NOW).kind).toBe("hold");
  });

  it("refuses to promote on a single good run", () => {
    const t = transition(state({ history: [70] }), 79, NOW);
    expect(t.kind).toBe("hold");
  });

  it("refuses to promote on a bare threshold crossing", () => {
    // 76 is LEGENDARY, but the margin requires 78.
    const t = transition(state({ history: [76] }), 76, NOW);
    expect(t.kind).toBe("hold");
  });

  it("promotes once the margin is cleared for two consecutive runs", () => {
    const t = transition(state({ history: [79] }), 80, NOW);
    expect(t).toEqual({ kind: "promote", to: "LEGENDARY", from: "EPIC" });
  });

  it("does not demote inside the 30-day class floor", () => {
    const t = transition(
      state({ current: "LEGENDARY", since: "2026-08-20T00:00:00Z", history: [40, 40] }),
      40, NOW,
    );
    expect(t.kind).toBe("hold");
    if (t.kind === "hold") expect(t.reason).toContain("floor");
  });

  it("demotes only after three sustained runs below the margin", () => {
    const old = { current: "LEGENDARY" as const, since: "2026-01-01T00:00:00Z" };
    // `history` is prior runs; the current score appends to it. Two prior
    // runs plus this one is three, which is exactly the demote requirement.
    expect(transition({ ...old, history: [70] }, 70, NOW).kind).toBe("hold");
    const t = transition({ ...old, history: [70, 70] }, 70, NOW);
    expect(t).toEqual({ kind: "demote", to: "EPIC", from: "LEGENDARY" });
  });

  it("does not flip a repo parked on a boundary", () => {
    // The exact failure hysteresis exists to prevent: 75.6 either side of
    // the LEGENDARY gate should never move.
    let s = state({ current: "EPIC", history: [] });
    for (const run of [75.6, 76.2, 75.4, 76.1, 75.9, 76.3]) {
      const t = transition(s, run, NOW);
      expect(t.kind).toBe("hold");
      s = { ...s, history: [...s.history, run] };
    }
  });

  it("uses the configured margins rather than hard-coded numbers", () => {
    const lenient = { ...HYSTERESIS, promoteMargin: 0, promoteRuns: 1 };
    const t = transition(state({ history: [] }), 76, NOW, THRESHOLDS, lenient);
    expect(t.kind).toBe("promote");
  });
});
