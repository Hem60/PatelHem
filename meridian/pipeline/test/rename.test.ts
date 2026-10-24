/**
 * Renames.
 *
 * `RAG-CHAT-BOT` was renamed to `agentic-rag-chat-bot` and the survey failed:
 *
 *     skills > names a repository the catalogue holds in every evidence line
 *     AssertionError: Embedding stores: RAG-CHAT-BOT — vector lookup behind
 *     the chat surface: expected false to be true
 *
 * The catalogue itself was fine — it is regenerated from the live account
 * every run, so the new name appeared and the old one did not. What went
 * stale was everything that pinned the old name by hand, and the quiet cost
 * was the class history: state keyed by name means a rename reads as a
 * deletion plus a creation, so the grant date resets and the hysteresis that
 * stops a project flickering between bands starts again from nothing.
 *
 * These tests cover the recognition and the three migrations, and most of
 * them are about the ways this could go wrong rather than the happy path —
 * moving one project's history onto another is far worse than not moving it
 * at all.
 */
import { describe, expect, it } from "vitest";
import { detectRenames, migrateKeys, rewriteNames } from "../src/rename.js";
import type { Catalogue, StateEntry } from "../src/catalogue.js";

const entry = (id?: number): StateEntry => ({
  ...(id === undefined ? {} : { id }),
  current: "UNCOMMON",
  since: "2026-01-01T00:00:00.000Z",
  history: [31, 33, 37.7],
  axesAtGrant: { stability: 12.9 },
  compositeAtGrant: 37.7,
});

const cat = (state: Record<string, StateEntry>): Catalogue =>
  ({ user: "Hem60", generated: "", partMax: {}, entries: [], state }) as unknown as Catalogue;

describe("recognising a rename", () => {
  it("matches on the id, not the name", () => {
    const got = detectRenames(cat({ "RAG-CHAT-BOT": entry(42) }), { "agentic-rag-chat-bot": 42 });
    expect(got).toEqual([{ from: "RAG-CHAT-BOT", to: "agentic-rag-chat-bot", id: 42 }]);
  });

  it("says nothing when the name is unchanged", () => {
    expect(detectRenames(cat({ vakil: entry(7) }), { vakil: 7 })).toEqual([]);
  });

  it("never guesses from a similar name", () => {
    /*
     * Two different repositories, different ids. A heuristic on name
     * similarity would call this a rename and move one project's class
     * history onto another — the exact failure worth being strict about.
     */
    const got = detectRenames(cat({ "rag-chat-bot": entry(1) }), { "rag-chat-bot-v2": 2 });
    expect(got).toEqual([]);
  });

  it("detects nothing when previous state has no ids", () => {
    /*
     * State written before ids were recorded carries none. The first run
     * after this ships adopts ids and claims no rename, which is correct:
     * there is no evidence one happened.
     */
    expect(detectRenames(cat({ "RAG-CHAT-BOT": entry() }), { "agentic-rag-chat-bot": 42 })).toEqual([]);
  });

  it("handles a deletion and an unrelated creation without pairing them", () => {
    const got = detectRenames(cat({ gone: entry(1) }), { fresh: 2 });
    expect(got).toEqual([]);
  });
});

describe("moving a name-keyed record", () => {
  const renames = [{ from: "old", to: "new", id: 1 }];

  it("carries the value onto the new key", () => {
    const { next, moved } = migrateKeys({ old: "x", other: "y" }, renames);
    expect(next).toEqual({ new: "x", other: "y" });
    expect(moved).toEqual(["old → new"]);
  });

  it("does nothing when there is no record under the old name", () => {
    /* a repository may simply have had no prose written for it */
    const { next, moved } = migrateKeys({ other: "y" }, renames);
    expect(next).toEqual({ other: "y" });
    expect(moved).toEqual([]);
  });

  it("never overwrites something already under the new name", () => {
    /*
     * Whatever sits under the new name was written deliberately and is about
     * the repository as it is now. The old record is the stale one, and
     * replacing the new with the old is the worst outcome of a rename.
     */
    const { next, moved } = migrateKeys({ old: "stale", new: "current" }, renames);
    expect(next.new).toBe("current");
    expect(next.old).toBe("stale");
    expect(moved).toEqual([]);
  });

  it("leaves the input untouched", () => {
    const input = { old: "x" };
    migrateKeys(input, renames);
    expect(input).toEqual({ old: "x" });
  });
});

describe("rewriting a name inside authored prose", () => {
  const renames = [{ from: "RAG-CHAT-BOT", to: "agentic-rag-chat-bot", id: 1 }];

  it("replaces the name where a person wrote it in a sentence", () => {
    expect(rewriteNames("RAG-CHAT-BOT — vector lookup behind the chat surface", renames)).toBe(
      "agentic-rag-chat-bot — vector lookup behind the chat surface",
    );
  });

  it("replaces every occurrence, not just the first", () => {
    expect(rewriteNames("vakil and RAG-CHAT-BOT; also RAG-CHAT-BOT", renames)).toBe(
      "vakil and agentic-rag-chat-bot; also agentic-rag-chat-bot",
    );
  });

  it("does not rewrite a longer name that merely contains the old one", () => {
    /* the bound that stops "RAG-CHAT-BOT" eating "RAG-CHAT-BOT-legacy" */
    expect(rewriteNames("RAG-CHAT-BOT-legacy", renames)).toBe("RAG-CHAT-BOT-legacy");
  });

  it("treats a name with regex characters literally", () => {
    const odd = [{ from: "a.b+c", to: "safe", id: 2 }];
    expect(rewriteNames("a.b+c and axbxc", odd)).toBe("safe and axbxc");
  });

  it("leaves text alone when nothing was renamed", () => {
    const text = "vakil — chargeback adjudication";
    expect(rewriteNames(text, [])).toBe(text);
  });
});
