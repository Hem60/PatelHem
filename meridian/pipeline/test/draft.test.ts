/**
 * The drafter's gate.
 *
 * `scripts/draft.mjs` is the only place in this build where words arrive from
 * a language model, so it is the only place where an unchecked claim could
 * reach a card. Plumb cannot help here: it verifies Herald's templates against
 * real paths, and a free-form sentence has no path to check.
 *
 * What stands in its place is a blunt filter — length caps and a list of words
 * that would turn a description into a claim. These tests pin it, because the
 * filter is the whole safety argument for option A: the model may choose the
 * words, but it may not make a claim about adoption, quality or scale that
 * nothing in the survey measured.
 *
 * They make no network request. The gate is a pure function, imported.
 */
import { describe, expect, it } from "vitest";
// @ts-expect-error — a plain .mjs script, deliberately not part of the TS build
import { GATE, reject, tidy } from "../scripts/draft.mjs";

/** A draft that should pass: specific, measured, no praise. */
const good = {
  thesis: "A retrieval-augmented chat service that answers questions against a supplied document set.",
  description: "Written in Python, with a test suite under tests/ and continuous integration configured. The repository contains the retrieval pipeline and the service that fronts it.",
};

describe("typographic tidying", () => {
  /*
   * The first successful run came back full of U+2011 NON-BREAKING HYPHENs:
   * "self‑classifying", "end‑to‑end", "docker‑compose". They render, but
   * they are not the hyphen the rest of the page uses, they break text search
   * on the card, and they are invisible in a diff.
   *
   * These characters are also invisible in the source of `tidy` itself, which
   * is exactly why the behaviour is pinned here rather than trusted to a
   * character class nobody can read.
   */
  it("replaces the hyphens a model reaches for with the one the page uses", () => {
    expect(tidy("self‑classifying")).toBe("self-classifying");
    expect(tidy("end‐to‐end")).toBe("end-to-end");
  });

  it("replaces non-breaking and narrow spaces with an ordinary space", () => {
    expect(tidy("a b")).toBe("a b");
    expect(tidy("a b")).toBe("a b");
  });

  it("straightens curly quotes", () => {
    expect(tidy("it’s “quoted”")).toBe("it's \"quoted\"");
  });

  it("leaves the em dash alone, because the site's own prose uses it", () => {
    expect(tidy("a — b")).toBe("a — b");
  });

  it("collapses runs of whitespace and trims", () => {
    expect(tidy("  a   b\n c  ")).toBe("a b c");
  });

  it("changes nothing in text that is already plain", () => {
    const plain = "A Flask API that serves a RandomForest classifier.";
    expect(tidy(plain)).toBe(plain);
  });
});

describe("the drafter's gate", () => {
  it("passes a plain, measured draft", () => {
    expect(reject(good)).toBe(null);
  });

  it("rejects every unverifiable claim it knows about", () => {
    for (const word of GATE.FORBIDDEN as string[]) {
      const result = reject({ ...good, description: `${good.description} It is ${word}.` });
      expect(result, word).not.toBe(null);
      expect(result, word).toContain("unverifiable claim");
    }
  });

  it("catches a claim in the thesis as well as the description", () => {
    expect(reject({ ...good, thesis: "A production-ready retrieval service." })).toContain(
      "unverifiable claim",
    );
  });

  it("is case-insensitive, so a capitalised claim does not slip past", () => {
    expect(reject({ ...good, thesis: "Enterprise document retrieval." })).toContain(
      "unverifiable claim",
    );
  });

  it("treats the model declining as a rejection, not as text", () => {
    /* INSUFFICIENT is the correct answer to thin facts. It must never ship. */
    expect(reject({ thesis: "INSUFFICIENT", description: "INSUFFICIENT" })).toContain("declined");
  });

  it("rejects an empty or missing thesis", () => {
    expect(reject({ thesis: "   ", description: "x" })).not.toBe(null);
    expect(reject({ description: "x" })).not.toBe(null);
    expect(reject(null)).not.toBe(null);
    expect(reject(undefined)).not.toBe(null);
  });

  it("enforces the length caps", () => {
    expect(reject({ ...good, thesis: "a".repeat(GATE.MAX_THESIS + 1) })).toContain("over");
    expect(reject({ ...good, description: "a".repeat(GATE.MAX_DESCRIPTION + 1) })).toContain("over");
  });

  it("allows a draft with no description at all", () => {
    /* A thesis alone is a complete answer; the paragraph is a bonus. */
    expect(reject({ thesis: good.thesis, description: "" })).toBe(null);
  });
});
